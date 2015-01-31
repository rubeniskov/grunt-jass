module.exports = function( grunt ) 
{
    var defaults        = 
        ({
            'src'       : './src',

            'target'    : './doc',

            'quite'     : false,

            'template'  : './doc/doc-template.md'
        }),

        und             = grunt.util._,

        path            = require( 'path' ),

        doc             = require( 'yuidocjs' ),

        twig            = require('twig').twig,

        build           = function( options )
        {
            var modules         = [],

                json            = new doc.YUIDoc
                ({ 
                    quiet       : false,

                    writeJSON   : false,

                    paths       :[ '/Users/ruben.lopez/Enviroment/deploy/ueWidgets/src' ]

                }).run();

            return save( getModules( json ) );
        },

        save            = function( result )
        {
            grunt.file.write( '/Users/ruben.lopez/Enviroment/deploy/ueWidgets/doc/schema.json' , JSON.stringify( result, null, 4 ) );

            und.each( result, function( module, index )
            {
                grunt.file.write( path.join( '/Users/ruben.lopez/Enviroment/deploy/ueWidgets/doc/markdown/', 'doc-' + module.name + '.md' ), template({ methods : module.methods }) )
            });

            return result;
        },

        getMethods      = function( json, module )
        {
            var methods       = [],

                method_module, method_matches, method_type, method_syntax, method_name, method_args;

            und.each( json.classitems, function( method, index )
            {
                method_module       = method.submodule ?    method.submodule : method.module;

                method_matches      = method.name ?         method.name.match( /([a-z\-\_0-9\.]+)(\(([\[\]\s\-a-z0-9\,\.]+)\))?/i ) : [];

                method_type         = method.itemtype;

                method_syntax       = method_matches[ 0 ];

                method_name         = method_matches[ 1 ];

                method_args         = method_matches[ 3 ];

                if( module == null || method_module == module )
                {
                    methods.push
                    ({
                        'name'              : method_name,

                        'type'              : method_type,

                        'module'            : method_module,

                        'description'       : method.description,

                        'file'              : method.file,

                        'line'              : method.line,

                        'overloads'         : [],

                        'example'           : method.example
                    });
                }
                    
            });

            return methods;
        },

        getModules      = function( json )
        {
            var modules         = [];

            und.each( json.modules, function( module, module_name )
            {
                modules.push
                ({
                    'name'              : module_name,

                    'modules'           : Object.keys( module.submodules ),

                    'methods'           : getMethods( json, module_name ),

                    'file'              : module.file,

                    'line'              : module.line,

                    'description'       : module.description
                });
            });

            return modules;
        },

        template        = function( json, template )
        {
            var twigTemplate    = grunt.file.read( '/Users/ruben.lopez/Enviroment/deploy/ueWidgets/doc/doc-template.md', { encoding : 'UTF-8' });

            return twig
            ({ 

                data: twigTemplate

            }).render( json )
        };

    return ({ build : build });
}