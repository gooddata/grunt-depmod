/*global node:true*/
var fs = require('fs'),
    path = require('path'),
    esprima = require('esprima'),
    options = {};

function traverseAST(r, ast, pattern) {
    if (!ast) return false;

    var same = false;
    if (pattern.type === ast.type) {
        same = true;
        for(key in pattern) {
            if (pattern.hasOwnProperty(key)) {
                same &= JSON.stringify(pattern[key]) === JSON.stringify(ast[key]);
            }
            if (!same) break;
        }
        same && r.push(ast);
    }

    switch(ast.type) {
        case 'Program':
        case 'BlockStatement':
            ast.body.forEach(function(e) {
                if (!same) same = traverseAST(r, e, pattern);
            });
            break;
        case 'IfStatement':
            same = traverseAST(r, ast.consequent, pattern);
            same = traverseAST(r, ast.alternate, pattern);
            break;
        case 'ExpressionStatement':
            same = traverseAST(r, ast.expression, pattern);
            break;
        case 'CallStatement':
            same = traverseAST(r, ast.callee, pattern);
            break;
    }
}

var YAHOO_REGISTER_AST = {
    "type": "CallExpression",
    "callee": {
        "type": "MemberExpression",
        "computed": false,
        "object": {
            "type": "Identifier",
            "name": "YAHOO"
        },
        "property": {
            "type": "Identifier",
            "name": "register"
        }
    }
};

var YUI_ADD_AST = {
    "type": "CallExpression",
    "callee": {
        "type": "MemberExpression",
        "computed": false,
        "object": {
            "type": "Identifier",
            "name": "YUI"
        },
        "property": {
            "type": "Identifier",
            "name": "add"
        }
    }
};

var DOJO_PROVIDE_AST = {
    "type": "CallExpression",
    "callee": {
        "type": "MemberExpression",
        "computed": false,
        "object": {
            "type": "Identifier",
            "name": "dojo"
        },
        "property": {
            "type": "Identifier",
            "name": "provide"
        }
    }
};

var REQUIRE_AST = {
    "type": "CallExpression",
    "callee": {
        "type": "Identifier",
        "name": "require"
    }
};

var DEFINE_AST = {
    "type": "CallExpression",
    "callee": {
        "type": "Identifier",
        "name": "define"
    }
};

var DOJO_REQUIRE_AST = {
    "type": "CallExpression",
    "callee": {
        "type": "MemberExpression",
        "computed": false,
        "object": {
            "type": "Identifier",
            "name": "dojo"
        },
        "property": {
            "type": "Identifier",
            "name": "require"
        }
    }
};

function checkDefine(filename, ast) {
    var matches;
    var name;

    matches = [];
    traverseAST(matches, ast, DEFINE_AST);

    var requires = [];
    matches.forEach(function(s) {
        var arg = s['arguments'][0];

        // get the module name if present
        if (arg.type === "Literal") {
            name = arg.value;
            arg = s['arguments'][1];
        }
        // dependencies
        if (arg.elements) {
            requires.push.apply(requires, arg.elements.map(function(e) { return e.value; }));
        }
    });

    return depmodNameRequires(name, filename, requires, 'r.js');
}

function checkRequire(filename, ast) {
    var matches;

    matches = [];
    traverseAST(matches, ast, REQUIRE_AST);

    var requires = [];
    matches.forEach(function(s) {
        requires.push( s['arguments'][0].value );
    });

    return depmodNameRequires(undefined, filename, requires, 'commonjs');
}

function depmodNameRequires(name, filename, requires, fwk) {
    if (!name) {
        // if the module name is give as its full path then use just the basename
        var name = filename.match(/(packages|components|apps|lib|scripts)\/(.*?)(\.js)?$/);
        name = name && name[2];
    }
    // if not in the pattern
    if (!name) name = path.basename(filename, '.js');

    // console.log('req: ', name, filename);
    return [ depmodEntry(name, filename, requires, fwk) ];
}

function checkDojoRequire(filename, ast) {
    var matches;

    matches = [];
    traverseAST(matches, ast, DOJO_PROVIDE_AST);
    var name = filename;
    matches.forEach(function(s) {
        name = s['arguments'][0].value;
    });
    if (name === filename) return 0;

    matches = [];
    traverseAST(matches, ast, DOJO_REQUIRE_AST);

    var requires = [];
    matches.forEach(function(s) {
        requires.push( s['arguments'][0].value );
    });
    return [ depmodEntry(name, filename, requires, 'dojo') ];
}

function checkYUI(filename, ast) {
    var matches = [];
    traverseAST(matches, ast, YUI_ADD_AST);
    traverseAST(matches, ast, YAHOO_REGISTER_AST);

    // ###
    // console.log(filename);

    if (!matches.length) return 0;

    var aliases = options.aliases || {};

    return matches.map(function(s) {
        var name = s['arguments'][0].value;
        var details = s['arguments'][3];
        // console.log('d: ', filename, details && details.properties);
        var requires = details && details.properties.filter(function(p) {
            // key as an identifier or as a string
            return p.key.name === 'requires' || p.key.value === 'requires';
        })[0];
        requires = requires && requires.value.elements.map(function(e) { return e.value; });

        // console.log('m: ', name, requires);

        // expand aliases (normally present in YUI.Env.aliases)
        requires = requires && aliases && requires.reduce(function(deps, dep) {
            if (aliases[dep]) {
                // console.log('expanding alias', dep, aliases[dep]);
                deps.push.apply(deps, aliases[dep]);
            } else {
                deps.push(dep);
            }
            return deps;
        }, []);

        return depmodEntry(name, filename, requires, 'yui');
    });
}

function processCSS(filename) {
    return depmodEntry(filename, filename, []);
}

function depmodEntry(name, filename, requires, framework) {
    var root = './';

    if (options.processName) {
        name = options.processName(name, filename);
    }

    var m = {
        name: name,
        path: filename,
    };

    if (framework) m.framework = framework;
    if (requires && requires.length) m.requires = requires;
    if (filename.search(/\.css$/) != -1) m.type = "css";
    return {name: name, module: m};
}

function processFile(filename) {
    if (filename.search(/\.css$/) != -1) {
        return [ processCSS(filename) ];
    }

    // options.fs for other than real filesystem contents read
    var contents = (options.fs || fs).readFileSync(filename, 'utf-8')

    //console.log(filename, contents.length);

    // strip the first #! line
    contents = contents.replace(/^#!.*/, '');

    try {
        var ast = esprima.parse(contents);
    } catch(e) {
        console.error('Parse error:', filename, ':', e);

        // note: avoid throwing, this should only generate deps
        //       one should rather watch the output and fix the issue
    }
    //console.log(filename, 'ast');

    var yui = checkYUI(filename, ast);
    if (yui) return yui;

    var dojo = checkDojoRequire(filename, ast);
    if (dojo) return dojo;

    var req = checkDefine(filename, ast);
    if (req) return req;

    var req = checkRequire(filename, ast);
    if (req) return req;

    // FIXME: no 'require' containing files could also be modules
    return undefined; // FIXME...
}

function _resolve(mods, modName, resolved) {
    var mod = mods[modName];
    if (!mod) {
        console.log('error: missing module: ', modName);
        return [];
    }

    if (resolved[modName]) return [];
    resolved[modName] = true;

    if (!mod.requires) return [mod];

    var deps = [];
    mod.requires.forEach(function(n) {
        deps.push.apply(deps, _resolve(mods, n, resolved));
    });
    deps.push(mod);
    return deps;
}

exports.resolve = function resolve(mods, modName) {
    var deps = _resolve(mods, modName, {});
    var fileHash = {};
    var files = [];
    deps.forEach(function(m) {
        // drop duplicates in case there are multiple modules
        // in the same file (e.g. via YUI.add)
        if (fileHash[m.path]) return;

        fileHash[m.path] = m;
        files.push(m.path);
    });
    return files;
}

exports.getDepmod = function getDepmod(files, opts) {
    // set global options...
    options = opts;

    var mods = files.map(processFile).reduce(function(mods, current){
        current && current.forEach(function(file) {
            mods[file.name] = file.module;
        });
        return mods;
    }, {});

    return mods;
};
