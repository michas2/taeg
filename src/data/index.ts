import { LocalStorageRepository } from "./LocalStorageRepository";
import type { Repository } from "./Repository";

/**
 * The single place that chooses a persistence implementation.
 * Swap this for a backend-backed Repository later to enable sync.
 */
export const repository: Repository = new LocalStorageRepository();

export type { Repository } from "./Repository";
