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

        Twig            = require( 'twig' ),

        requirejs       = require( 'requirejs' ),

        cache           = {},

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

                //skipPragmas             : true,

                //keepAmdefine            : true,

                wrap                    : 
                {
                    start       : '(function(e,t){e(t,function(e){return function(n,r,i){e[n]=i.apply(t,function(){for(var t=0;t<r.length;t++){r[t]=e[r[t]]}return r}())}}({}))})(function(global,define){\n\n',

                    end         : '\n\n},this);'
                },

                onBuildRead             : function( name, _path, contents )
                {
                    if( cache[ name ] )
                        return cache[ name ];
                    
                    return cache[ name ] = parse( name, _path, contents, options ? options.flags : {} );
                },

                onBuildWrite        : function( name, _path, contents )
                {
                    //grunt.log.writeln( name, (/ue.asset/).test( name ) );

                    return banner( 'file', { name : name, path : _path, lines : contents.split(/\r\n|\r|\n/).length })
                            + evaluate( contents.replace( /^(define)/gi, '__$1') );


                }
            });
        },

        isWidget        = function( name, flags )
        {
            return ( /ue\.widget\./ ).test( name );
        },

        isAsset         = function( name, flags )
        {
            return ( /ue\.asset\./ ).test( name );
        },

        isCore         = function( name, flags )
        {
            return ( /ue\.core/ ).test( name );
        },

        template        = function( name, _path )
        {
            var content = '',

                filename= path.dirname( _path ) + '/view.html';

            try
            {
                grunt.log.writeln( 'Reading template config ' + filename );
                   
                content = grunt.file.read( filename, { encoding : 'UTF-8' })
            }
            catch( ex )
            {
                grunt.log.error( ex );
            }

            return content
                .replace(/\n/g, "")
                .replace(/[\t ]+\</g, "<")
                .replace(/\>[\t ]+\</g, "><")
                .replace(/\>[\t ]+$/g, ">");
        },

        packageJSON     = function( name, _path )
        {
            var content = '{}',

                filename= path.dirname( _path ) + '/package.json';

            try
            {
                grunt.log.writeln( 'Reading package config ' + filename );
                   
                content = grunt.file.read( filename, { encoding : 'UTF-8' })
            }
            catch( ex )
            {
                grunt.log.error( ex );
            }

            return eval( '(' + content + ')' );
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

                content = str.slice( str.indexOf( '{' ) + 1, str.lastIndexOf( '}' ) );

            return isCore( name ) ? content : 'define( "' + name + '", ' + ( deps.length ? '[ "' + deps.join( '","' ) + '" ]' : '[]' ) + ', ' + str + ');';
        },

        parse           = function( name, _path, content, flags )
        {  
            var widget  = false;

            if( isAsset( name ) || ( widget = isWidget( name ) ) )
                flags = und.extend( { 'template' : widget ? template( name, _path ) : '' }, flags, packageJSON( name, _path ) );

            try
            {
                content = Twig.twig({ data : content }).render( flags || {} )
            }
            catch( ex )
            {
                console.log( ex );

                grunt.log.error( ex );
            }

            return content;
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

        Twig.extend( function( Twig )
        {
            Twig.token.definitions = 
            [
                {
                    type: Twig.token.type.raw,
                    open: '<% raw %>',
                    close: '<% endraw %>'
                },
                {
                    type: Twig.token.type.output,
                    open: '<@',
                    close: '@>'
                },
                {
                    type: Twig.token.type.logic,
                    open: '<%',
                    close: '%>'
                },
                {
                    type: Twig.token.type.comment,
                    open: '<#',
                    close: '#>'
                }
            ];
        });

    return ({ build : build });
}