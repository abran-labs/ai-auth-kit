import { createAuthKit, emptyState, projectStorage } from "@contract/source";
import type { AuthKitOptions, AuthKitState } from "@contract/source";

const storage = projectStorage("contract", { rootDir: "/tmp/contract" });
const options: AuthKitOptions = { storage };
const kit = createAuthKit(options);
const state: AuthKitState = emptyState();

void kit;
void state;
