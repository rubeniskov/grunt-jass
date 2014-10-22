module.exports = function(grunt) 
{
    var und             = grunt.util._,

        deasync         = require('deasync'),

        path            = require( 'path' ),

        requirejs       = require( 'requirejs' ),

        gitclone        = require( 'nodegit').Repo.clone,

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

        resolveLibs     = function( libraries, base )
        {
            var libs    = {};

            und.each( libraries, function( lib, lib_name )
            {
                libs[ lib_name ]    = resolvePath( lib.dist || lib, base );

                lib.dirname         = resolvePath( lib_name, base );

                lib.dist            = resolvePath( lib.dist, lib.dirname );

                if( lib.modules )
                    libs = und.extend( libs, resolveLibs( lib.modules, base ) );
            });

            return libs;
        },

        spawn           = function( cmd, params, callback )
        {
            var current     = 0

                delay       = 10,

                timeout     = 60000, 

                sync        = false;

            grunt.util.spawn({ cmd : cmd, args : params }, function( error, result, code )
            {
                sync        = true;

                callback && callback.call && callback.call( null, error, result, code );
            });

            while( !sync )
            {
                deasync.sleep( delay );

                if( current > timeout )
                {
                    callback && callback.call && callback.call( null, 'TIMEOUT', 
                    {
                        stdout : 'Timeout exceded'
                    }, -1 );

                    break;
                }

                current += delay;
            }

            return sync
        },

        clone           = function( name, git, branch )
        {
            grunt.log.subhead( 'Cloning [' + name + '][ ver: ' + branch + ']\n\t' + git );

            return spawn( 'git',[ 'clone', git, path.join( project_path, 'lib', name ) ], '--branch ' + branch, function( error, result, code )
            {
                console.log( arguments );
                grunt.log.writeln( result.stdout );
            });
        },

        compile         = function( name, module, options )
        {
            var contents    = false,

                gruntfile   = path.join( module.dirname, 'Gruntfile.js' );

            grunt.log.subhead( 'Prepare to compile ' + name);

            (function( build )
            {
                build.call && build.call
                ({
                    npm   : function( cmd )
                    {
                        console.log( arguments, module.dirname, 'cd ' + module.dirname + ' && ' + cmd  );

                        return spawn.call( null, npm + ' -C ' + module.dirname );
                    }
                },
                function()
                {
                    params      = Array.prototype.slice.call( arguments );

                    params.push( '--gruntfile=' + gruntfile );

                    grunt.log.subhead( 'Compiling ' + name + ' with ' + ( params.length ?  params.join( ' ' ) : 'no params' ) );

                    grunt.verbose.writeln( 'Gruntfile: ' + gruntfile );

                    spawn( 'grunt',params, function( error, result, code )
                    {
                        if( error )
                            console.log( error );

                        grunt.log.writeln( result.stdout );

                        contents = grunt.file.read( target,
                        {
                            encoding: 'UTF8'    
                        });
                    });
                });
            })
            ( module.build || function()
            {
                console.log( 'Nothing to compile' );
            });

            params.push( '--gruntfile='+gruntfile );

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
            grunt.log.subhead( 'Checking [' + build_name + '] build' );

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