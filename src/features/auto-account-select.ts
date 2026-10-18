import { configRead } from '../core/config';

import {
  ResolveCommandRegistry,
  type ResolveCommandHook
} from '../platform/app-api';

const registry = await ResolveCommandRegistry.getInstance();

const hook: ResolveCommandHook = function (resolveCommand, payload, extra) {
  if (!configRead('autoAccountSelect')) {
    return resolveCommand(payload, extra);
  }

  const finalEndpoint = payload?.startAccountSelectorCommand // @ts-expect-error TS doesn't allow optional chaining on `unknown`. See: github.com/microsoft/TypeScript/issues/37700
    ?.nextEndpoint as unknown;

  registry.dispatchCommand({
    onIdentityChanged: {
      identityActionContext: {
        nextEndpoint: finalEndpoint,
        eventTrigger: 'ACCOUNT_EVENT_TRIGGER_WHOS_WATCHING'
      },
      isSameIdentity: true
    },
    commandMetadata: { webCommandMetadata: { clientAction: true } }
  });
};

registry.setHook('startAccountSelectorCommand', hook);
