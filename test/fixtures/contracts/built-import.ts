import { createAuthKit, emptyState, projectStorage } from "@contract/built";
import type { AuthKitOptions, AuthKitState } from "@contract/built";

const storage = projectStorage("contract", { rootDir: "/tmp/contract" });
const options: AuthKitOptions = { storage };
const kit = createAuthKit(options);
const state: AuthKitState = emptyState();

void kit;
void state;
