import "fake-indexeddb/auto";
import { DexieLickRepository, LickLabDb } from "../../src/adapters/dexie/licks.js";
import { lickRepositoryContract } from "./lick-contract.js";

let n = 0;
lickRepositoryContract("dexie", () => new DexieLickRepository(new LickLabDb(`test-${Date.now()}-${(n += 1)}`)));
