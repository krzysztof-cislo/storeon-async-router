# storeon-async-router

<img src="https://storeon.github.io/storeon/logo.svg" align="right"
     alt="Storeon logo by Anton Lovchikov" width="160" height="142">
     
Asynchronous router for [Storeon].    

It size is 950 bytes (minified and gzipped) and uses [Size Limit](https://github.com/ai/size-limit) to control size.

### Overview
The key features are:
* allows **async** route handlers for prefetch the data or lazy loading of modules
* support for **abort** the routing if there was some navigation cancel eg. by fast clicking
* allows **update** routing definition in fly (eg, when you are loading some self module lazy which should add self controlled routes).
* **ignores** same routes navigation


This router is implementation of idea of **state first routing**, which at first place reflects the 
navigation within the state, and reflection within the UI stay on application side. 
Also this library is decoupled from browser history. 
Examples of integration with browser history or UI code you can find in recipes.

### Api
- `asyncRoutingModule` - is storeon module which contains the whole logic of routing
- `onNavigate(store, route, callback)` - function which registers route callback, on provided store for provided route (path regexp). Callback is a function which will be called if route will be matched, can returns undefined or promise. In case of promise, route will be not applied (navigation will be not ended) until  the promise will be not resolve, callback is also taking the [abortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), to be notified that current processing navigation was cancelled.  Important think is that last registered handle have a higher priority, so if at the end you will register handle for route '', that handle will catch all navigations
- `navigate(store, url, [replace], [force])` - function which triggers navigation to particular url
- `cancelNavigation(store)` - function which cancel current navigation (if there is any in progress)

### Examples

#### Creating the store with router module 
```javascript
import createStore from 'storeon';
import { asyncRoutingModule } from 'storeon-async-router';

// create store with adding route module
const store = createStore([asyncRoutingModule]);

// register some route handle
onNavigate(store, '/home', () => {
    console.log('home page');
});

// in any point of application we can call navigate
navigate(store, '/home');

// and at the end get the current route (eg for conditions in UI
store.get().routing.current.route; // => '/home'
```

#### Redirection
```javascript
import createStore from 'storeon';
import { asyncRoutingModule, onNavigate, navigate } from 'storeon-async-router';

// create store with adding route module
const store = createStore([asyncRoutingModule]);

// register route for any route and in handle navigate to other path
onNavigate(store, '', () => {
    navigate(store, '/404')
});  
``` 

#### Async route handle
##### Preloading the data
```javascript
import createStore from 'storeon';
import { asyncRoutingModule, onNavigate } from 'storeon-async-router';
 // create store with adding route module
const store = createStore([asyncRoutingModule]);

// register route for some page, where in handle we will fetch the data 
onNavigate(store, '/home', async (navigation, abortSignal) => {
    // retrieve the data from server
    const homeContent = await fetch('myapi/home.json');
    // check that navigation was not cancelled
    if (!abortSignal.aborted) {
        // set the data to state by event 
        store.dispatch('home data loaded', homeContent);    
    }
});  
``` 

### Recipes 

#### Lazy loading of submodule
For application code splitting we can simple use es6 `import()` function. In case when you will want to spilt your by the 
routes, you can simple do that with async router. What you need to do is just await for `import()` your lazy module within the 
route handle. You can additionally extend your routing within the loaded module.

```javascript    
// app.js
import createStore from 'storeon';
import { asyncRoutingModule, onNavigate, navigate } from 'storeon-async-router';

// create store with adding route module
const store = createStore([asyncRoutingModule]);
// register the navigation to admin page, but keeps reference to unregister function
const unRegister = onNavigate(store, '/admin', async (navigation, abortSignal) => {
    // preload some lazy module
    const adminModule = await import('./lazy/adminModule.js');
    // check that navigation was not cancelled
    if (!abortSignal.aborted) {
        // unregister app level route handle for that route
        // the lazy module will take by self control over the internal routing 
        unRegister();
        // init module, here we will register event handlers on storeon in lazy loaded module 
        adminModule.adminModule(store);
        // navigate once again (with force flag) to trigger the route handle from lazy loaded module 
        navigate(store, navigation.url, false, true);
    }
});
```

```javascript    
// ./lazy/adminModule.js
import { onNavigate } from 'storeon-async-router';

/**
 * @param {*} store
 */
export function adminModule(store) {
    // registering own routing handler
    onNavigate(store, '/admin', async () => {
        console.log('ADMIN');
    });
}
```

#### Integration with browser history
In order to synchronize the routing state within the store with the browser history (back/forward, location) 
we can simple connect the store with browser history object by fallowing code:

```javascript    
import createStore from 'storeon';
import { asyncRoutingModule, onNavigate, navigate, EVENTS } from 'storeon-async-router';

// create store with adding route module
const store = createStore([asyncRoutingModule]);

// returns full url 
function getLocationFullUrl() {
    return window.location.pathname
        + (window.location.search ? window.location.search : '')
        + (window.location.hash ? window.location.hash : '');
}

// on application start navigate to current url
setTimeout(() => {
    navigate(store, getLocationFullUrl(), false);
});

// connect with back/forwad of browser history
window.addEventListener('popstate', () => {
    navigate(store, getLocationFullUrl());
});

// connecting store changes to browser history
store.on(EVENTS.NAVIGATION_ENDED, async (state, navigation) => {
    // ignore url's from popstate
    if (getLocationFullUrl() !== navigation.url) {
        navigation.replace ?
            window.history.replaceState({}, '', navigation.url) :
            window.history.pushState({}, '', navigation.url);
    }
});
```

#### Handling the anchor click events globally
To handle any html anchor click over the page you cansimple create global click handler like that:
```javascript
```

#### Encapsulate routing to shared router object
If you do not want always to deliver store to utility functions you can simple encapsulate all functionality to single 
router object.
```javascript
import createStore from 'storeon';
import { asyncRoutingModule, onNavigate, navigate, cancelNavigation } from 'storeon-async-router';

// create store with adding route module
const store = createStore([asyncRoutingModule]);
// router factory
function routerFactory(store) {
    return {
        get current() {
            return store.get().routing.current;
        },
        navigate: navigate.bind(null, store),
        onNavigate: onNavigate.bind(null, store),
        cancelNavigation: cancelNavigation.bind(null, store)
    }
}
// router instance
const router = routerFactory(store);
// adding handle
router.onNavigate('/home', () => {});
// navigate to url
router.navigate('/home'); 
``` 



### Internal data flow
1. user registers the handles by usage of `onNavigate` (can do this in stereon module, but within the @init callback),

    1.1 for each registered handle we generating unique `id`,
     
    1.2 cache the handle under that `id`, and dispatch `route register` event with provided route and handle `id`     

2. on `route register` we are storing in state provided route and id (at the top of stack)
3. on `navigate` event 

    3.1. we checking exit conditions (same route, or same route navigation in progres),
     
    3.2. if there is any ongoing navigation we are dispatch `navigation cancel` event
    
    3.3. then we are setting the `next` navigation in state,
    
    3.4. asynchronously dispatch `before navigation` event
    
4.  on `before navigation` event 

    4.1 we are looking in state for handle `id` which route matches requested url, by the matched `id` we are taking the
handle from cache,

    4.2. we creates AbortController from which we are taking the AbortSignal, 
    
    4.3. we attach to storeon handle for `navigation canceled` event to call `cancell` on AbortController 
    
    4.4. we call handle with details of navigation and abortSignal, if the result of handle call is Promise, we are waits to 
resolve, 

    4.5 we are dispatch `navigation end` event, and unregister `navigation canceled` handle

5. on `navigation canceled` we are clear the `next` navigation in state
6. on `navigation end` we move `next` to `current` ins state


