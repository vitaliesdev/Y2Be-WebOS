import { extractLaunchParams, handleLaunch } from '../core/utils';

function main() {
  handleLaunch(extractLaunchParams());
}

main();
