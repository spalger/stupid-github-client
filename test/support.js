import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Promise from 'bluebird';

Promise.longStackTraces();

chai.should();
chai.use(chaiAsPromised);
