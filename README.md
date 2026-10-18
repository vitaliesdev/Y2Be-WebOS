<p align="center">
  <img src="assets/extraLargeIcon.png" width="96" alt="Y2Be TV">
</p>

<h1 align="center">Y2Be TV</h1>

<p align="center">
  An alternative YouTube client for LG webOS TVs (webOS 4 and newer):
  no ads, SponsorBlock, no Shorts, and remote shortcuts.
</p>

> Started as a fork of [webosbrew/youtube-webos](https://github.com/webosbrew/youtube-webos)
> and now developed separately.
>
> Not affiliated with, endorsed by or sponsored by Google or YouTube.
> YouTube is a trademark of Google LLC.

## Features

- Ad blocking
- [SponsorBlock](https://sponsor.ajay.app/): skips sponsors, intros, reminders and more, and marks them on the progress bar
- Hide Shorts everywhere, including the sidebar
- Remote shortcuts:
  - 🟩 **Green**: settings
  - 🟥 **Red** / 🟨 **Yellow** in a video: previous / next chapter
  - 🟥 **Red** elsewhere: refresh the page (e.g. new recommendations)
  - 🟦 **Blue** in a video: audio-only mode
- Force the highest video quality
- Remove end screens
- Skip the account selection screen on startup
- Higher-quality thumbnails, on-screen clock, hide the logo
- Settings in English or Spanish, following the TV language

## Install

Uninstall the official YouTube app first: this app replaces it, so the remote's YouTube button, casting from a phone and voice search keep working.

Install the `.ipk` from [Releases](https://github.com/vitaliesdev/Y2Be-WebOS/releases), or one you built yourself, with [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop) or the [webOS CLI](#install-from-the-command-line).

## Build

Requires Node.js (see `devEngines` in [package.json](package.json)), [pnpm](https://pnpm.io) and git.

```sh
git clone https://github.com/vitaliesdev/Y2Be-WebOS.git
cd Y2Be-WebOS
pnpm install
pnpm run build
pnpm run package
```

The `.ipk` is generated in the project root. Use `pnpm run build:dev` instead of `build` for an unminified build with debug logging.

## Install from the command line

1. On the TV, install the **Developer Mode** app from the LG Content Store, sign in with an [LG Developer account](https://webostv.developer.lge.com/login) and enable _Developer Mode_ and _Key Server_.
2. Add the TV (IP and passphrase are shown in the Developer Mode app):

   ```sh
   pnpm exec ares-setup-device
   ```

3. Install, launch, and inspect with Chrome DevTools:

   ```sh
   pnpm run deploy
   pnpm run launch
   pnpm run inspect
   ```

## Autostart

To have the app show up as an input source and start with the TV, run this on the TV via SSH (rooted TVs):

```sh
luna-send-pub -n 1 'luna://com.webos.service.eim/addDevice' '{"appId":"youtube.leanback.v4","pigImage":"","mvpdIcon":""}'
```

To undo it:

```sh
luna-send-pub -n 1 'luna://com.webos.service.eim/deleteDevice' '{"appId":"youtube.leanback.v4"}'
```

## License

[GPL-3.0](LICENSE), like the original project.
