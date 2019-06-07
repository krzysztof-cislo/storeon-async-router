import * as createStore from 'storeon';
import { onNavigate, asyncRoutingModule, navigate, cancelNavigation } from '../index.js';

describe(`simple scenarions`, () => {

    let store;
    beforeEach(() => {
        store = createStore([asyncRoutingModule]);
    });

    it(`Router should call handle for proper registered route`, async () => {
        const spy = sinon.fake();
        onNavigate(store, '/', spy);
        const res = await navigate(store, '/a');
        expect(res).true;
        expect(store.get().routing.current.url).eq('/a');
        expect(spy).to.be.calledOnce;
        expect(spy.getCall(0).args[0].url).eq('/a');
        expect(spy.getCall(0).args[0].route).eq('/');
    });

    it(`Router should ignore second navigation for same url`, async () => {
        const spy = sinon.fake.returns(Promise.resolve());
        onNavigate(store, '/a', spy);
        const res = await Promise.all([
            navigate(store, '/a'),
            navigate(store, '/a')]);
        expect(spy).to.be.calledOnce;
        expect(res).eql([true, false]);
    });

    it(`Router should ignore navigation for same url as current`, async () => {
        const spy = sinon.fake();
        onNavigate(store, '/a', spy);
        let res = await navigate(store, '/a');
        expect(res).true;
        expect(spy).to.be.calledOnce;
        res = await navigate(store, '/a');
        expect(res).not.true;
        expect(spy).to.be.calledOnce;
    });


    it(`Router should cancel previous navigation immediately if navigation occurs just after previous`, async () => {
        const spy = sinon.fake();
        onNavigate(store, '/a', spy);
        const res = await Promise.all([
            navigate(store, '/a/1'),
            navigate(store, '/a/2'),
        ]);
        expect(res).eql([false, true]);
        expect(spy).to.be.calledOnce;
        expect(spy.getCall(0).args[0].url).eq('/a/2');
        expect(spy.getCall(0).args[0].route).eq('/a');
        expect(store.get().routing.current.url).eq('/a/2');
        expect(store.get().routing.current.route).eq('/a');
    });

    it(`Route should cancel previous navigation navigation occurs during previous`, async () => {
        const spy = sinon.fake();
        let semaphor;
        onNavigate(store, '/a', async (n, s) => {
            semaphor = navigate(store, '/b');
            await semaphor;
            expect(s.aborted);
        });
        onNavigate(store, '/b', spy);
        const res1 = await navigate(store, '/a');
        const res2 = await semaphor;
        expect(res1).not.true;
        expect(res2).true;
        expect(spy).to.be.calledOnce;
        expect(spy.getCall(0).args[0].url).eq('/b');
        expect(spy.getCall(0).args[0].route).eq('/b');
        expect(store.get().routing.current.url).eq('/b');
        expect(store.get().routing.current.route).eq('/b');
    });

    it('Router should throw error if the navigation occurs for not registered route', async () => {
        await expect(navigate(store, '/a')).to.be.rejected;
    });

    it('Router should throw error if the navigation handle throws error', async () => {
        onNavigate(store, '', () => {
            throw new Error('Error');
        });
        await expect(navigate(store, '/')).to.be.rejected;
    });

    it('Router should allows to replace the handle of route on the fly', async () => {
        const spy1 = sinon.fake();
        const spy2 = sinon.fake();
        const un1 = onNavigate(store, '', spy1);
        await navigate(store, '/1');
        expect(spy1).to.be.calledOnce;
        const un2 = onNavigate(store, '', spy2);
        await navigate(store, '/2');
        expect(spy1).to.be.calledOnce;
        expect(spy2).to.be.calledOnce;
        un2();
        await navigate(store, '/3');
        expect(spy2).to.be.calledOnce;
        expect(spy1).to.be.calledTwice;
    });

    it('Router should allows to cancel sync navigation', async () => {
        onNavigate(store, '/a', () => {});
        onNavigate(store, '/b', () => {
            cancelNavigation(store);
        });

        await navigate(store, '/a');
        let result = await navigate(store, '/b');
        expect(result).not.true;
        expect(store.get().routing.current.url).eq('/a');
        expect(store.get().routing.current.route).eq('/a');

    });

    it('Router should allows to cancel async navigation', async () => {
        let continueA;
        onNavigate(store, '/a', () => {});
        onNavigate(store, '/b', () => {
            return new Promise(res => continueA = res)
        });

        await navigate(store, '/a');

        let promise = navigate(store, '/b');
        setTimeout(() => {
            cancelNavigation(store);
            continueA();
        });
        const result = await promise;
        expect(result).not.true;
        expect(store.get().routing.current.url).eq('/a');
        expect(store.get().routing.current.route).eq('/a');

    });

    it('Router should allows for redirection', async () => {
        onNavigate(store, '/a', () => {});
        onNavigate(store, '/b', () => {
            return navigate(store, '/a');
        });
        const result = await navigate(store, '/b');

        // expect(result).true;
        expect(store.get().routing.current.url).eq('/a');
        expect(store.get().routing.current.route).eq('/a');
    });

});