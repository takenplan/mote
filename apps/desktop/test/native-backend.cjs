// Load the real TypeScript backend with its ordinary file URLs. A namespaced
// test import adds a query suffix, which changes production worker entry URLs.
require('tsx/esm/api').register();
module.exports=specifier=>import(specifier);
