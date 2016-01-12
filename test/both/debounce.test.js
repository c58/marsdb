import Collection from '../../lib/Collection';
import debounce from '../../lib/debounce';
import chai, {expect} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();


describe('debounce', function () {
  it('should return a promise when calls count out of batch size', function () {
    const cb = sinon.spy();
    const debouncedCb = debounce(cb, 100, 2);
    let res;

    res = debouncedCb();
    res.should.be.an.instanceof(Promise);
    cb.should.have.been.callCount(0);
    res = debouncedCb();
    res.should.be.an.instanceof(Promise);
    cb.should.have.been.callCount(0);
    res = debouncedCb();
    res.should.be.an.instanceof(Promise);
    cb.should.have.been.callCount(1);
    res = debouncedCb();
    res.should.be.an.instanceof(Promise);
    cb.should.have.been.callCount(1);
    res = debouncedCb();
    res.should.be.an.instanceof(Promise);
    cb.should.have.been.callCount(2);
    res = debouncedCb();
    res.should.be.an.instanceof(Promise);
    cb.should.have.been.callCount(2);
  });
});
