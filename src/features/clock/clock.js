import { configRead, configAddChangeListener } from '../../core/config';
import './clock.css';
import { requireElement } from '../../platform/player/helpers';

class Watch {
  #watch;
  #timer;
  #attrChanges;
  #PLAYER_SELECTOR = 'ytlr-watch-default';

  constructor() {
    this.createElement();
    this.startClock();
    this.playerEvents();
  }

  createElement() {
    this.#watch = document.createElement('div');
    this.#watch.className = 'webOs-watch';
    document.body.appendChild(this.#watch);
  }

  startClock() {
    const nextSeg = (60 - new Date().getSeconds()) * 1000;

    const formatter = new Intl.DateTimeFormat(navigator.language, {
      hour: 'numeric',
      minute: 'numeric'
    });

    const setTime = () => {
      this.#watch.innerText = formatter.format(new Date());
    };

    setTime();
    this.#timer = setTimeout(() => {
      setTime();
      this.#timer = setInterval(setTime, 60000);
    }, nextSeg);
  }

  playerAppear(video) {
    this.changeVisibility(video);
    this.playerObserver(video);
  }

  changeVisibility(video) {
    const focused = video.getAttribute('hybridnavfocusable') === 'true';
    this.#watch.style.display = focused ? 'none' : 'block';
  }

  async playerEvents() {
    const player = await requireElement(this.#PLAYER_SELECTOR, HTMLElement);
    // The clock may have been turned off while waiting.
    if (!this.#watch || !document.body.contains(this.#watch)) return;
    this.playerAppear(player);
  }

  playerObserver(node) {
    this.#attrChanges = new MutationObserver(() => {
      this.changeVisibility(node);
    });

    this.#attrChanges.observe(node, {
      attributes: true,
      attributeFilter: ['hybridnavfocusable']
    });
  }

  destroy() {
    // Either the first-minute timeout or the interval.
    clearTimeout(this.#timer);
    clearInterval(this.#timer);
    this.#watch?.remove();
    this.#attrChanges?.disconnect();
  }
}

let watchInstance = null;

function toggleWatch(show) {
  if (show) {
    watchInstance = watchInstance ? watchInstance : new Watch();
  } else {
    watchInstance?.destroy();
    watchInstance = null;
  }
}

toggleWatch(configRead('showWatch'));

configAddChangeListener('showWatch', (evt) => {
  toggleWatch(evt.detail.newValue);
});
