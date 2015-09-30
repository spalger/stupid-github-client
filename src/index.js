import Wreck from 'wreck';
import { format, parse, resolve as resolveUrl } from 'url';
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

    headers(headers) {
      return this._fork({ headers });
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
      return this._fork({
        path: `/${segs.map(encodeURIComponent).join('/')}`,
      });
    }

    _fork(params) {
      return new Request(params, this);
    }

    _getReq({path, method, query, body, authorize, headers} = this.params) {
      // request url
      const parsed = parse(path || '');
      parsed.query = query || parsed.query || {};
      if (cacheBust) {
        parsed.query = assign({ ts: Date.now() }, parsed.query);
      }
      const url = format(parsed);

      const options = {
        baseUrl: apiUrl,
        payload: body,
        headers: headers || {},
      };

      // request headers
      if (authorize !== false && apiToken) {
        options.headers = assign({ authorization: `token ${apiToken}` }, options.headers);
      }

      return { method, url, options };
    }

    then(...args) {
      return this.send().then(...args);
    }

    send(overrides) {
      const params = overrides ? assign({}, this.params, overrides) : this.params;

      if (this.params.once && execChains.has(this)) {
        return execChains.get(this);
      }

      execChains.set(this, (
        resolve(execChains.get(this))
        .then(async () => {
          const req = this._getReq(params);

          const resp = await fromNode(cb => {
            Wreck.request(req.method, req.url, req.options, cb);
          });

          const body = await fromNode(cb => {
            Wreck.read(resp, { json: true }, cb);
          });

          if (!resp) {
            throw new InvalidResponse(req, resp);
          }

          return {
            body,
            status: resp.statusCode,
            headers: resp.headers,
          };
        })
      ));

      return execChains.get(this);
    }
  }

  return new Request();
}
