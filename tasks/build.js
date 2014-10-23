module.exports = function(grunt) 
{
    var und             = grunt.util._,

        path            = require( 'path' ),

        requirejs       = require( 'requirejs' ),

        shell           = require( 'shelljs' ),

        project_path    = process.cwd(),

        defaults        = 
        {
            libraries       : './lib/',

            patches         : './patches/',

            source          : './src/',

            dependencies    : 
            {

            },

            wrap            : 
            {

                start       : false,

                end         : false
            },

            paths           : {}      
        },

        resolveOptions  = function( options )
        {
            var opt_compile         = grunt.option( 'compile' ),

                opt_configure       = grunt.option( 'configure' );
            
            options.configure       = ( opt_configure     || false )                    ? true : false,

            options.compile         = ( opt_compile       || opt_configure || false )   ? true : false,

            options.libraries       = resolvePath( options.libraries    || defaults.libraries ),

            options.patches         = resolvePath( options.patches      || defaults.patches ),

            options.source          = resolvePath( options.source       || defaults.source ),

            options.paths           = resolveLibs( options.dependencies || defaults.dependencies, options.libraries )

            return options;
        },

        resolvePath     = function( _path, base )
        {
            if( _path && !( /^\// ).test( _path ) )
                _path    = path.join( base || project_path, _path );

            return _path;
        },

        resolveLibs     = function( modules, base )
        {
            var mods    = {};

            und.each( modules, function( mod, mod_name )
            {
                typeof mod == "string" && ( mod = { dist : mod } );

                mod.dirname         = resolvePath( mod_name, base );

                mods[ mod_name ]    = mod.dist  = resolvePath( mod.dist, mod.dirname ).replace( /\.js$/, '' );

                und.each( mod.modules, function( smod, smod_name )
                {
                    mods[ smod_name ] = resolvePath( smod, mod.dirname ).replace( /\.js$/, '' );
                });
            });

            return mods;
        },

        exec            = function( cmd )
        {
            var result  = shell.exec( cmd );

            switch( result.code )
            {
                case 0:
                    grunt.log.ok( result.output );
                break;
                case 1:
                case 2:
                    grunt.log.error( result.output );
                break;
                default:
                    grunt.verbose.write( result.output );
                break;
            }

            return result.code;
        },

        clone           = function( name, git, branch )
        {
            grunt.log.subhead( 'Cloning [ ' + name + ' ][ ver: ' + branch + ' ]\n\t' + git );

            var result  = exec( 'git clone ' + git + ' ' + path.join( project_path, 'lib', name ) + ' --branch ' + branch );

            return result === 128 || result === 0;
        },

        compile         = function( name, module, options )
        {
            var contents    = false,

                gruntfile   = path.join( module.dirname, 'Gruntfile.js' );

            grunt.log.subhead( 'Prepare to compile [ ' + name + ' ][ ver: ' + module.version + ' ]' );

            (function( build )
            {
                build.call && build.call
                ({
                    module  : module,

                    npm     : function()
                    {
                        var params      = Array.prototype.slice.call( arguments );

                        shell.cd( module.dirname );

                        grunt.verbose.writeln( 'Execute: ' + 'sudo npm ' + params.join( ' ' ) );

                        return shell.exec( 'sudo npm ' + params.join( ' ' ) ).code !== 0;
                    },
                    grunt   : function()
                    {
                        var params      = Array.prototype.slice.call( arguments );

                        params.push( '--gruntfile=' + gruntfile );

                        grunt.log.subhead( 'Compiling ' + name + ' with ' + ( params.length ?  params.join( ' ' ) : 'no params \n' ) );

                        grunt.verbose.writeln( 'Gruntfile: ' + gruntfile );

                        if( shell.exec( 'grunt ' + params.join( ' ' ) ).code !== 0 )
                        {
                            contents = grunt.file.read( module.dist,
                            {
                                encoding: 'UTF8'    
                            });
                        };
                    }
                });
            })
            ( module.build || function( compile )
            {
                console.log( 'Nothing to compile' );
            });

            return contents;
        },

        configure       = function( dependencies, options )
        {
            var result  = true;

            und.each( dependencies, function( dep, name )
            {
                if( !clone( name, dep.git, dep.version ) )
                    return result = false;

                compile( name, dep );
            });

            return result;
        },

        builder         = function( input, output, options )
        {
            grunt.log.writeln( 'Building file [' + input + '] output [' + output + ']' );

            grunt.verbose.writeln( 'Input File: ' + input + '\nOutput File: ' + output + '\nOptions: \n ' + JSON.stringify( options, null, 4 ) );

            requirejs.optimize
            ({
                baseUrl             : options.source,

                name                : input.replace( /\.js$/, '' ),

                out                 : resolvePath( output ),

                wrap                : 
                {

                    startFile       : resolvePath( options.wrap.start, options.source ),

                    endFile         : resolvePath( options.wrap.end, options.source )
                },

                rawText             : {},

                optimize            : 'none',

                findNestedDependencies : true,

                skipSemiColonInsertion : false,

                paths               : options.paths,

                onBuildRead        : function( name, _path, contents )
                {
                    grunt.verbose.writeln( 'Module Read', name );

                    

                    return contents;
                },            

                toTransport         : function()
                {
                    console.log( "toTransport", arguments );
                },

                onBuildWrite        : function( name, _path, contents )
                {
                    var lib         = {}, 

                        compiled    = contents;

                    grunt.log.writeln( 'Module ' + name );

                    if( ( lib = options.libraries[ name ] ) && ( compiled = compile( name, lib, _path ) ) )
                        contents    = compiled;

                    return contents;
                }
            });
        }

    grunt.registerMultiTask( 'jass', 'Compiling javascript files.', function( target ) 
    {
        var config          = grunt.config('jass'),

            done            = this.async(),

            flags           = this.flags,

            optIn           = flags[ "*" ];

        und.each( config, function( build, build_name ) 
        {
            grunt.log.subhead( 'Checking [ ' + build_name + ' ] build' );

            build.files     = build.files || {};

            build.options   = resolveOptions( build.options );

            (function( factory )
            {
                if( build.options.configure )
                {
                    if( configure( build.options.dependencies ) )
                        return factory();
                    else
                        throw new Error( 'Configure fails' );
                }

                factory();
            })
            (function()
            {
                grunt.verbose.writeln( 'Build options: \n' + JSON.stringify( build.options, null, 4 ) );

                grunt.verbose.writeln( 'Build files: \n' + JSON.stringify( build.files, null, 4 ) );

                und.each( build.files, function( input, output )
                {
                    builder( input, output, build.options );
                });
            });
            
        });
        
        done();
    });
}