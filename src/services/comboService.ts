import type { Combo, ComboDraft, ComboPatch, ComboTestInput, DataProvenance, UnsupportedCapability } from '../domain/platform';
import type { OmniRouteManagementAdapter } from '../integrations/omniroute/managementAdapter';
import { HttpOmniRouteManagementAdapter } from '../integrations/omniroute/managementAdapter';
import type { AppBindings } from '../server/app';
import { getEnvironmentIdentity } from './capabilityService';

export class ComboService {
  constructor(private readonly omniroute: OmniRouteManagementAdapter) {}

  async list(): Promise<{ items: Combo[]; provenance: DataProvenance } | null> {
    return this.omniroute.listCombos();
  }

  async get(id: string): Promise<{ item: Combo | null; provenance: DataProvenance } | null> {
    const result = await this.omniroute.listCombos();
    if (!result) return null;
    return { item: result.items.find((combo) => combo.id === id) ?? null, provenance: result.provenance };
  }

  async create(_draft: ComboDraft): Promise<UnsupportedCapability> {
    return mutationUnsupported('combos.create');
  }

  async update(_id: string, _input: ComboPatch): Promise<UnsupportedCapability> {
    return mutationUnsupported('combos.update');
  }

  async delete(_id: string, _expectedRevision: string): Promise<UnsupportedCapability> {
    return mutationUnsupported('combos.delete');
  }

  async test(_id: string, _input: ComboTestInput): Promise<UnsupportedCapability> {
    return mutationUnsupported('combos.test');
  }
}

export function createComboService(env: AppBindings) {
  const environment = getEnvironmentIdentity(env?.ENVIRONMENT);
  const adapter = new HttpOmniRouteManagementAdapter({
    origin: env?.OMNIROUTE_ORIGIN,
    originToken: env?.OMNIROUTE_ORIGIN_TOKEN,
    environmentId: environment.id,
  });
  return { environmentId: environment.id, service: new ComboService(adapter) };
}

function mutationUnsupported(capability: string): UnsupportedCapability {
  return {
    status: 'unsupported',
    capability,
    reason: 'The local OmniRoute mutation contract, authentication, revision, and response semantics are not runtime-verified.',
    documented: true,
    runtimeVerified: false,
  };
}
