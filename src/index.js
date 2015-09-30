import request from 'superagent';
import { resolve as resolveUrl } from 'url';
import fromNode from '@spalger/fromnode';

const { assign } = Object;
const { isArray } = Array;
const resolve = () => new Promise(res => res());

export class FailedResp extends Error {
  constructor(req, resp) {
    super();
    this.req = req;
    this.resp = resp;
  }
}


export class NeedsLogin extends FailedResp {}
export class NeedsPermission extends FailedResp {}
export class InvalidResponse extends FailedResp {}

export function factory({
  apiUrl = 'https://api.github.com',
  apiToken = null,
  cacheBust = false,
  execChains = new WeakMap(),
  defaults = {
    method: 'get',
    url: apiUrl,
  },
}) {
  class Request {
    constructor(params, prev) {
      this.params = assign(
        {}, // write to a new object
        defaults, // start with the defaults
        prev ? prev.params : {}, // include the previous reqs params
        params || {}, // start with the passed params
      );
    }

    query(query) {
      return this._fork({ query });
    }

    body(body) {
      return this._fork({ body });
    }

    authorize(authorize) {
      return this._fork({ authorize });
    }

    once(once = true) {
      return this._fork({ once });
    }

    method(method) {
      return this._fork({
        method: (method + '').toUpperCase(),
      });
    }

    path(path) {
      const segs = isArray(path) ? path : path.split('/').filter(Boolean);
      const url = resolveUrl(apiUrl, `/${segs.map(encodeURIComponent).join('/')}`);
      return this._fork({ url });
    }

    _fork(params) {
      return new Request(params, this);
    }

    _getReq() {
      const {url, method, query, body, authorize} = this.params;
      const req = request(method, url);

      if (cacheBust) {
        req.query(assign({ ts: Date.now() }, query));
      } else if (query) {
        req.query(query);
      }

      if (body) {
        req.send(body);
      }

      if (authorize !== false) {
        if (apiToken) req.set('authorization', `token ${apiToken}`);
      }

      return req;
    }

    then(...args) {
      return this.send().then(...args);
    }

    send() {
      if (this.params.once && execChains.has(this)) {
        return execChains.get(this);
      }

      execChains.set(this, (
        resolve(execChains.get(this))
        .then(async () => {
          const req = this._getReq();
          const resp = await fromNode(cb => req.end(cb));

          if (!resp || resp.status >= 300 || resp.status < 200) {
            throw new InvalidResponse(req, resp);
          }

          const { body, status, headers, ok, type, text } = resp;
          return { body, status, headers, ok, type, text };
        })
      ));

      return execChains.get(this);
    }
  }

  return new Request();
}
