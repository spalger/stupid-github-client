import chai from 'chai';
import nock from 'nock';

chai.should();

import { factory } from '../src/index';

describe('@spalger/github-client', function() {
  describe('factory()', function() {
    it('allows creating a base client with specific defaults, etc.', function() {
      const client = factory({
        apiUrl: 'nonsense',
        apiToken: 'also nonsense',
        cacheBust: true,
        defaults: {
          method: 'post',
          url: 'not the apiUrl',
          query: {
            spencer: true,
          },
        },
      });

      client.params.should.eql({
        method: 'post',
        url: 'not the apiUrl',
        query: {
          spencer: true,
        },
      });

      const req = client._getReq();
      req.method.should.equal('post');
      req.url.should.equal('not the apiUrl');
      req.request().getHeader('authorization').should.equal(`token also nonsense`);
    });
  });

  describe('Client/Request class', function() {
    it('creates a new client for after each modification', function() {
      const apiUrl = 'http://apiurl.com';
      const client = factory({ apiUrl });
      const client2 = client.path('/me');

      client.should.not.equal(client2);
      client._getReq().url.should.equal(apiUrl);
      client2._getReq().url.should.equal(apiUrl + '/me');
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
  });
});
