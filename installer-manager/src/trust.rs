use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;

pub const REPOSITORY: &str = "abran-labs/ai-auth-kit";
pub const WORKFLOW: &str = ".github/workflows/release.yml";
pub struct EmbeddedKey<'a> {
    pub key_id: &'a str,
    pub public_key_hex: &'a str,
}

impl EmbeddedKey<'_> {
    pub fn bytes(&self) -> Result<[u8; 32], String> {
        let mut bytes = [0_u8; 32];
        let source = self.public_key_hex.as_bytes();
        if source.len() != 64 {
            return Err("embedded Ed25519 public key is malformed".to_owned());
        }
        for (index, slot) in bytes.iter_mut().enumerate() {
            let offset = index.checked_mul(2).ok_or("embedded key offset overflow")?;
            let left = hex_value(source[offset])?;
            let right = hex_value(source[offset + 1])?;
            *slot = left.checked_mul(16).ok_or("embedded key nibble overflow")? | right;
        }
        Ok(bytes)
    }
}

const PUBLIC_KEY_TOML: &str = include_str!("../public-key.toml");
#[cfg(feature = "test-manager")]
const TEST_PUBLIC_KEY_TOML: &str = include_str!("../test-public-key.toml");

pub fn public_key() -> Result<EmbeddedKey<'static>, String> {
    parse_embedded_key(PUBLIC_KEY_TOML)
}

#[cfg(feature = "test-manager")]
pub fn test_public_key() -> Result<EmbeddedKey<'static>, String> {
    parse_embedded_key(TEST_PUBLIC_KEY_TOML)
}

fn parse_embedded_key(source: &'static str) -> Result<EmbeddedKey<'static>, String> {
    let mut key_id = None;
    let mut public_key_hex = None;
    for line in source.lines() {
        let Some((name, raw_value)) = line.split_once('=') else {
            continue;
        };
        let value = raw_value.trim().trim_matches('"');
        match name.trim() {
            "key_id" => key_id = Some(value),
            "public_key_hex" => public_key_hex = Some(value),
            _ => return Err("embedded public-key.toml contains an unknown field".to_owned()),
        }
    }
    Ok(EmbeddedKey {
        key_id: key_id.ok_or("embedded public-key.toml has no key_id")?,
        public_key_hex: public_key_hex.ok_or("embedded public-key.toml has no public_key_hex")?,
    })
}

pub fn sha256_open_file(file: &mut File) -> Result<(String, u64), String> {
    use std::io::{Seek, SeekFrom};
    file.seek(SeekFrom::Start(0)).map_err(io)?;
    let mut hash = Sha256::new();
    let mut total = 0_u64;
    let mut buffer = [0_u8; 65_536];
    loop {
        let count = file.read(&mut buffer).map_err(io)?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
        total = total
            .checked_add(u64::try_from(count).map_err(|_| "size overflow")?)
            .ok_or("size overflow")?;
    }
    Ok((format!("{:x}", hash.finalize()), total))
}

fn hex_value(value: u8) -> Result<u8, String> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        _ => Err("embedded Ed25519 public key is malformed".to_owned()),
    }
}

fn io(error: std::io::Error) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    #[test]
    fn embedded_public_key_decodes() {
        assert_eq!(
            super::public_key().and_then(|key| key.bytes()),
            Ok([
                0xe0, 0x33, 0x83, 0x66, 0x4b, 0x45, 0xe3, 0x8b, 0x42, 0x83, 0xf2, 0xec, 0xd2, 0x68,
                0x3b, 0x06, 0x92, 0x23, 0x5f, 0x59, 0x6b, 0xbf, 0xf0, 0xe0, 0xde, 0xd8, 0x97, 0x94,
                0xcc, 0xae, 0x37, 0xa1,
            ])
        );
    }
}
