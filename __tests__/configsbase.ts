import { Mutex } from "async-mutex";
import { it } from '@jest/globals';

export const yamlDir = "__tests__/yaml-dir";
export let singleMutex = new Mutex()
it("Jest needs a test", () => { })