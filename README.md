grunt-depmod
============

Analyses .js files for various module systems and extracts the module names
and dependency information.

Recognizes the AMD

```
define('module-name', ['dep1-module'], function(dep1) {
    // ...
});
```

and the YUI3 module convention

```
YUI.add('module-name', function(Y) {
    // ...
}, '0.0.1', { requires: ['dep1-module'] });
```


Tasks
-----

### depmod

Generate the depmod information in JSON format

```
{
   'depmod': {
       other: {
           src: [ '**/[^\.]*.{css,js}' ],
           dest: 'other-depmod.json',
           processName: function(name, filename) {
               if (filename.match(/\.css$/)) {
                   return 'CSS!'+name;
               return name;
           }
       }
   }
}
```


### depmod-tracker

Analyze the depmod information and watch for changes. This can be further
used to consume the depmod information from within other grunt tasks.

```
{
   'depmod-tracker': {
       app: {
           src: [ '**/[^\.]*.{css,js}' ],
           processName: function(name, filename) { return name; },
           modulesInfo: [ 'other-depmod.json' ]
       }
   }
}
```


### depmod-resolve

Provide a list of files necessary for the specified module to load
with all transitive dependencies.

```
{
   'depmod-resolve': {
       app: {
           modulesInfo: [ 'other-depmod.json' ],
           module: 'my-app-main-module'
       }
   }
}
```


Release
-------

The release needs to be done via [npm trusted publishing](https://docs.npmjs.com/trusted-publishers). Set it up if needed.
See `mock-js` for the reference implementation and consult the frontend shared credentials guideline.

**Note:** Before the setup, make sure to upgrade Node.js to meet the minimum npm version requirements of trusted publishing.

Copyright
---------

Copyright (c) 2013, GoodData Corporation (BSD License)
