import { createProjectAuthKit } from "../src/index.js";

const kit = createProjectAuthKit("my-tool");

await kit.saveEnvCredential("openai", "OPENAI_API_KEY");
await kit.selectModel("openai", "gpt-5-mini");

const selection = await kit.resolveSelection();
const auth = await kit.runtimeAuth("openai");

console.log(selection?.provider.id, selection?.model.id, auth.env);
