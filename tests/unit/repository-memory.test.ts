import { MemoryLickRepository } from "../../src/adapters/memory/licks.js";
import { lickRepositoryContract } from "./lick-contract.js";

lickRepositoryContract("memory", () => new MemoryLickRepository());
