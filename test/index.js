import chai from 'chai';
import nock from 'nock';

chai.should();

import { factory } from '../src/index';

describe('@spalger/github-client', function() {
  describe('factory()', function() {
    it('allows creating a base client with specific defaults, etc.', function() {
      const client = factory({
        apiUrl: 'http://some.farm/github-api',
        apiToken: 'also nonsense',
        cacheBust: true,
        defaults: {
          method: 'post',
          path: '/me',
          query: {
            spencer: true,
          },
        },
      });

      client.params.should.eql({
        method: 'post',
        path: '/me',
        query: {
          spencer: true,
        },
      });

      const req = client._getReq();
      req.method.should.equal('post');
      req.url.split('?').shift().should.equal('/me');
      req.options.baseUrl.should.equal('http://some.farm/github-api');
      req.options.headers.authorization.should.equal(`token also nonsense`);
    });
  });

  describe('Client/Request class', function() {
    it('creates a new client for after each modification', function() {
      const apiUrl = 'http://apiurl.com/';
      const client = factory({ apiUrl });
      const client2 = client.path('/me');

      client.should.not.equal(client2);
      client._getReq().url.should.equal('');
      client2._getReq().url.should.equal('/me');
    });

    describe('#once()', function() {
      context('when called with nothing', function() {
        it('only executes the request once', async function() {
          let id = 0;
          const apiUrl = 'http://apiurl.com';
          nock(apiUrl)
            .get('/repos/org/repo')
            .once()
            .reply(200, () => {
              return { i: id++ };
            });

          const client = factory({ apiUrl })
            .path('/repos/org/repo')
            .once();

          let resp = await client.send();
          resp.body.should.eql({ i: 0 });

          resp = await client.send();
          resp.body.should.eql({ i: 0 });
        });
      });

      context('when passed `false`', function() {
        it('only executes the request each time .send() is called', async function() {
          let id = 0;
          const apiUrl = 'http://apiurl.com';
          nock(apiUrl)
            .get('/repos/org/repo')
            .twice()
            .reply(200, () => {
              return { i: id++ };
            });

          const client = factory({ apiUrl })
            .path('/repos/org/repo')
            .once(false);

          let resp = await client.send();
          resp.body.should.eql({ i: 0 });

          resp = await client.send();
          resp.body.should.eql({ i: 1 });
        });
      });
    });

    describe('#send()', function() {
      it('accepts apiUrls with paths', async function() {
        const apiHost = 'http://apiurl.com';
        const apiUrl = apiHost + '/github-api';

        nock(apiHost)
          .get('/github-api/me')
          .reply(200, { me: true });

        const client = factory({ apiUrl }).path('/me');
        const { body } = await client.send();
        body.should.eql({ me: true });
      });

      it('accepts param overrides', async function() {
        const apiUrl = 'http://apiurl.com';

        nock(apiUrl)
          .get('/me')
          .once()
          .reply(200, { me: true })
          .get('/you')
          .once()
          .reply(200, { you: true });

        const client = factory({ apiUrl }).path('/me');

        const { body: body1 } = await client.send();
        body1.should.eql({ me: true });

        const { body: body2 } = await client.send({ path: '/you' });
        body2.should.eql({ you: true });
      });

      it('responds with non-200 response codes', async function() {
        const apiUrl = 'http://apiurl.com';

        nock(apiUrl)
          .get('/')
          .reply(304, { 'Not Modified': true });

        const client = factory({ apiUrl });
        const { status, headers, body } = await client.send();
        status.should.equal(304);
        headers.should.eql({
          'content-type': 'application/json',
        });
        body.should.eql({
          'Not Modified': true,
        });
      });
    });
  });
});
