import type { AppBindings } from '../server/app';
import type { OmniRouteManagementAdapter } from '../integrations/omniroute/managementAdapter';
import { HttpOmniRouteManagementAdapter } from '../integrations/omniroute/managementAdapter';
import {
  buildCapabilityRegistry,
  buildSourceDiagnostics,
  buildSystemStatus,
  getEnvironmentIdentity,
} from './capabilityService';

export class SystemService {
  constructor(
    private readonly environmentName: string | undefined,
    private readonly omniroute: OmniRouteManagementAdapter,
  ) {}

  async getContext() {
    const runtime = await this.omniroute.getRuntimeInfo();
    const environment = getEnvironmentIdentity(this.environmentName, runtime);
    return { environment, runtime };
  }

  async getStatus() {
    const { environment, runtime } = await this.getContext();
    return {
      data: buildSystemStatus(environment, runtime),
      environment,
      provenance: [runtime.provenance],
    };
  }

  async getCapabilities() {
    const { environment, runtime } = await this.getContext();
    return {
      data: buildCapabilityRegistry(environment, runtime),
      environment,
      provenance: [runtime.provenance],
    };
  }

  async getSources() {
    const { environment, runtime } = await this.getContext();
    const sources = buildSourceDiagnostics(environment, runtime);
    return {
      data: { environment, sources },
      environment,
      provenance: sources.map((source) => source.provenance),
    };
  }

  async getEnvironment() {
    const { environment, runtime } = await this.getContext();
    return {
      data: environment,
      environment,
      provenance: [runtime.provenance],
    };
  }
}

export function createSystemService(env: AppBindings): SystemService {
  const provisionalEnvironment = getEnvironmentIdentity(env?.ENVIRONMENT);
  const adapter = new HttpOmniRouteManagementAdapter({
    origin: env?.OMNIROUTE_ORIGIN,
    originToken: env?.OMNIROUTE_ORIGIN_TOKEN,
    environmentId: provisionalEnvironment.id,
  });
  return new SystemService(env?.ENVIRONMENT, adapter);
}
