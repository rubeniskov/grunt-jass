module.exports = function( grunt ) 
{
    var defaults        = 
        ({
            'src'       : './src',

            'target'    : './doc',

            'quite'     : false
        }),

        und             = grunt.util._,

        path            = require( 'path' ),

        is              = require( 'is' ),

        twig            = require('twig').twig,

        requirejs       = require( 'requirejs' ),

        build           = function( source, output, options )
        {
            requirejs.optimize
            ({
                baseUrl                 : path.dirname( source ),

                name                    : path.basename( source ).replace( /\.js$/, '' ),

                out                     : output,

                rawText                 : {},

                optimize                : 'none',

                findNestedDependencies  : false,

                skipSemiColonInsertion  : true,

                wrap                    : 
                {
                    start       : '(function( factory ){ factory( window ) })(function( global ) {\n\n',

                    end         : '\n\n});'
                },

                onBuildRead             : function( name, _path, contents )
                {
                    return parse( contents, options ? options.flags : {} );
                },

                onBuildWrite        : function( name, _path, contents )
                {
                    return banner( 'file', { name : name, path : _path, lines : contents.split(/\r\n|\r|\n/).length }) + evaluate
                    ( 
                        contents
                            .replace( /^(define)/, '__$1')
                    );
                }
            });
        },

        banner          = function( type, data  )
        {
            var types = 
            {
                split   : 
                    '\n//-----------------------------------------------------------------------------\n',
                build   :
                    '\n/******************************************************************************\n' +
                    '\n//' +
                    '\n// Date: ' + new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') +
                    '\n// Build: Beta' +
                    '\n// Version: v0.0.1' +
                    '\n//\n'+
                    '\n******************************************************************************/\n',
                file    : 
                    '\n/******************************************************************************\n' +
                    '\n//' +
                    '\n// Name: ' + data.name +
                    '\n// Path: ' + path.relative( process.cwd(), data.path ) +
                    '\n// Lines: ' + data.lines +
                    '\n//\n'+
                    '\n******************************************************************************/\n'
                
            };

            return  types[ type ] ? types[ type ] : types[ 'split' ];
        },

        __define        = function( name, deps, callback )
        {
            if( typeof name !== 'string' ) 
            {
                callback    = deps;
                deps        = name;
                name        = null;
            }

            if( !is.array( deps ) ) 
            {
                callback    = deps;
                deps        = null;
            }

            var str     = callback.toString(),

                content = str.slice( str.indexOf( '{' ) + 1, str.lastIndexOf( '}' ) )

            return content;
        },

        parse           = function( content, flags )
        {   
            return twig({ data : content }).render( flags || {} );
        };

        evaluate        = function( input, flags )
        {   
            try
            {
                content = eval( input );
            }
            catch( ex )
            {
                eval( input )
            }

            return content;
        };

    return ({ build : build });
}