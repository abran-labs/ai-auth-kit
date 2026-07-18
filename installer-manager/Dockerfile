FROM rust:1.85.1-alpine3.21@sha256:4333721398de61f53ccbe53b0b855bcc4bb49e55828e8f652d7a8ac33dd0c118
ARG CARGO_FEATURES=""
WORKDIR /work
COPY Cargo.toml Cargo.lock ./
COPY public-key.toml test-public-key.toml ./
COPY src ./src
RUN apk add --no-cache build-base musl-dev && cargo build --locked --release $CARGO_FEATURES
