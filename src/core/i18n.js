// UI text in English and Spanish, picked from the TV's menu language.

export const APP_NAME = 'Y2Be TV';

/** @type {Record<'en' | 'es', Record<string, string>>} */
const strings = {
  en: {
    'opt.enableAdBlock': 'Block ads',
    'opt.removeShorts': 'Hide Shorts',
    'opt.upgradeThumbnails': 'Higher-quality thumbnails',
    'opt.hideLogo': 'Hide the logo',
    'opt.showWatch': 'Show a clock',
    'opt.forceHighResVideo': 'Always play at the highest quality',
    'opt.removeEndscreen': 'Remove end screens',
    'opt.autoAccountSelect': 'Skip account selection on startup',
    'opt.chapterSkipButtons': 'Skip chapters with [RED]/[YELLOW]',
    'opt.refreshButton': 'Refresh the page with [RED] (outside a video)',
    'opt.enableSponsorBlock': 'Enable SponsorBlock',
    'opt.enableSponsorBlockSponsor': 'Skip sponsors',
    'opt.enableSponsorBlockIntro': 'Skip intros',
    'opt.enableSponsorBlockOutro': 'Skip outros',
    'opt.enableSponsorBlockInteraction': 'Skip interaction reminders',
    'opt.enableSponsorBlockSelfPromo': 'Skip self-promotion',
    'opt.enableSponsorBlockMusicOfftopic':
      'Skip non-music parts in music videos',
    'opt.enableSponsorBlockPreview': 'Skip recaps and previews',

    'panel.sponsorCredit':
      'Segment skipping by SponsorBlock - sponsor.ajay.app',
    'hint.openSettings': 'Press [GREEN] to open the {app} settings',

    'audio.on': 'Audio-only mode: on',
    'audio.off': 'Audio-only mode: off',
    'audio.overlay': 'Audio-only mode - press [BLUE] to turn it off',

    'chapters.none': 'No chapters found',
    'chapters.noNext': 'No next chapter',
    'chapters.start': 'Start of video',
    'chapters.next': 'Next chapter: {n}/{total} · {time}',
    'chapters.prev': 'Previous chapter: {n}/{total} · {time}',

    refreshing: 'Refreshing...',
    'quality.selected': '{selected} selected (max {max})',

    'sb.skipping': 'Skipping {segment}',
    'sb.sponsor': 'sponsored segment',
    'sb.intro': 'intro',
    'sb.outro': 'outro',
    'sb.interaction': 'interaction reminder',
    'sb.selfpromo': 'self-promotion',
    'sb.music_offtopic': 'non-music part',
    'sb.preview': 'recap or preview'
  },
  es: {
    'opt.enableAdBlock': 'Bloquear anuncios',
    'opt.removeShorts': 'Ocultar Shorts',
    'opt.upgradeThumbnails': 'Miniaturas en mayor calidad',
    'opt.hideLogo': 'Ocultar el logo',
    'opt.showWatch': 'Mostrar un reloj',
    'opt.forceHighResVideo': 'Reproducir siempre en la máxima calidad',
    'opt.removeEndscreen': 'Quitar las pantallas finales',
    'opt.autoAccountSelect': 'Saltar la selección de cuenta al iniciar',
    'opt.chapterSkipButtons': 'Saltar capítulos con [ROJO]/[AMARILLO]',
    'opt.refreshButton': 'Refrescar la página con [ROJO] (fuera de un vídeo)',
    'opt.enableSponsorBlock': 'Activar SponsorBlock',
    'opt.enableSponsorBlockSponsor': 'Saltar patrocinios',
    'opt.enableSponsorBlockIntro': 'Saltar intros',
    'opt.enableSponsorBlockOutro': 'Saltar finales',
    'opt.enableSponsorBlockInteraction': 'Saltar recordatorios de interacción',
    'opt.enableSponsorBlockSelfPromo': 'Saltar autopromoción',
    'opt.enableSponsorBlockMusicOfftopic':
      'Saltar partes sin música en vídeos musicales',
    'opt.enableSponsorBlockPreview': 'Saltar resúmenes y avances',

    'panel.sponsorCredit':
      'Salto de segmentos por SponsorBlock - sponsor.ajay.app',
    'hint.openSettings': 'Pulsa [VERDE] para abrir los ajustes de {app}',

    'audio.on': 'Modo solo audio: activado',
    'audio.off': 'Modo solo audio: desactivado',
    'audio.overlay': 'Modo solo audio - pulsa [AZUL] para desactivarlo',

    'chapters.none': 'No hay capítulos',
    'chapters.noNext': 'No hay más capítulos',
    'chapters.start': 'Inicio del vídeo',
    'chapters.next': 'Siguiente capítulo: {n}/{total} · {time}',
    'chapters.prev': 'Capítulo anterior: {n}/{total} · {time}',

    refreshing: 'Actualizando...',
    'quality.selected': '{selected} seleccionada (máx. {max})',

    'sb.skipping': 'Saltando {segment}',
    'sb.sponsor': 'patrocinio',
    'sb.intro': 'intro',
    'sb.outro': 'final',
    'sb.interaction': 'recordatorio de interacción',
    'sb.selfpromo': 'autopromoción',
    'sb.music_offtopic': 'parte sin música',
    'sb.preview': 'resumen o avance'
  }
};

const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
const table = lang === 'es' ? strings.es : strings.en;

/**
 * Translated text for `key`, with `{name}` placeholders filled from `vars`.
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 */
export function t(key, vars) {
  let text = table[key] ?? strings.en[key] ?? key;
  if (vars) {
    for (const name in vars) {
      text = text.split(`{${name}}`).join(String(vars[name]));
    }
  }
  return text;
}
