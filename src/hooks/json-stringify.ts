import { configRead } from '../config';

function isPrimitive(
  value: unknown
): value is string | number | boolean | null | undefined | symbol | bigint {
  return Object(value) !== value;
}

const originalStringify = JSON.stringify;

type FunctionReplacer = (this: any, key: string, value: any) => any;
type WhitelistReplacer = (string | number)[] | null;

function stringify(
  value: unknown,
  replacer?: FunctionReplacer | WhitelistReplacer,
  space?: string | number
): string {
  if (!isPrimitive(value) && configRead('enableAdBlock')) {
    const root = value as Record<string, unknown>;
    const playbackContext = root.playbackContext as unknown;
    const ctx = isPrimitive(playbackContext)
      ? undefined
      : (playbackContext as Record<string, unknown>).contentPlaybackContext;

    if (!isPrimitive(ctx)) {
      // Copy only the path being modified: the objects may be frozen, and
      // cloning every stringified value is expensive.
      value = {
        ...root,
        playbackContext: {
          ...(playbackContext as Record<string, unknown>),
          contentPlaybackContext: { ...ctx, isInlinePlaybackNoAd: true }
        }
      };
      console.info(`[JSON.stringify] Set isInlinePlaybackNoAd`);
    }
  }

  return originalStringify(value, replacer as any, space);
}

JSON.stringify = stringify;
