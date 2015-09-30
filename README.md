# yet another simple github wrapper
You should probably just ignore this.

```js
// lib/github.js
import { factory } from '@spalger/github-client';
const github = factory({
  apiToken: 'XXXMY_API_TOKENXXX'
});

export const emoji = github.path('/emojis').once();

// then somewhere else in your application
import { emoji } from './lib/github';

const { body: emojiMap } = await emoji();
console.log(emojiMap);
```
