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
            var flags               = grunt.option.flags(),

                opt_compile         = grunt.option( 'compile' ),

                opt_configure       = grunt.option( 'configure' );
            
            options.configure       = ( opt_configure     || false )                    ? true : false,

            options.compile         = ( opt_compile       || opt_configure || false )   ? true : false,

            options.libraries       = resolvePath( options.libraries    || defaults.libraries ),

            options.source          = resolvePath( options.source       || defaults.source ),

            options.patches         = resolvePath( options.patches       || defaults.patches ),

            options.paths           = resolveLibs( options.dependencies || defaults.dependencies, options.patches, options.libraries );

            return options;
        },

        resolvePath     = function( _path, base )
        {
            if( _path && !( /^\// ).test( _path ) )
                _path    = path.join( base || project_path, _path );

            return _path;
        },

        resolveLibs     = function( modules, base_patches, base_libraries )
        {
            var mods    = {};
            
            und.each( modules, function( mod, mod_name )
            {
                typeof mod == "string" && ( mod = { dist : mod } );

                mod.dirname         = resolvePath( mod_name, base_libraries );

                if( mod.dist  )
                    mods[ mod_name ]    = mod.dist  = resolvePath( mod.dist, mod.dirname ).replace( /\.js$/, '' ); 

                mod.patches         = resolvePatches( mod.patches   || [], base_patches ),

                und.each( mod.modules, function( smod, smod_name )
                {
                    mods[ smod_name ] = resolvePath( smod, mod.dirname ).replace( /\.js$/, '' );
                });
            });

            return mods;
        },

        resolvePatches  = function( patches, base )
        {
            und.each( patches, function( patch, index )
            {
                patches[ index ]    = resolvePath( patch, base );
            });

            return patches;
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

        patch           = function( name, patches, options )
        {
            und.each( patches, function( patch )
            {
                grunt.log.subhead( 'Applying Patch [ ' + name + ' ][ Patch: ' + path.basename( patch ) + ' ]' );

                console.log( resolvePath( name, options.libraries ) );

                shell.cd( resolvePath( name, options.libraries ) );

                var result  = exec( 'git am --signoff < ' + patch );

                console.log( result );
            });
        },

        clone           = function( name, git, branch ) // sudo git am --signoff < ../../patches/jquery/fix_core_jquery_scope.patch
        {
            grunt.log.subhead( 'Cloning [ ' + name + ' ][ ver: ' + branch + ' ]\n\t' + git );

            var result  = exec( 'git clone ' + git + ' ' + path.join( project_path, 'lib', name ) + ' --branch ' + branch );

            return result === 128 || result === 0;
        },

        compile         = function( name, module, options )
        {
            var contents    = false,

                gruntfile   = path.join( module.dirname, 'Gruntfile.js' )

                distfile    = function()
                {
                    if( !module.dist )
                        return '';

                    return grunt.file.read( module.dist + '.js',
                    {
                        encoding: 'UTF8'    
                    });
                };

            grunt.log.subhead( 'Prepare to compile [ ' + name + ' ][ ver: ' + module.version + ' ]\n' );
            
            return (function( build )
            {
                return build.call && build.call
                ({
                    module  : module,

                    npm     : function()
                    {
                        if( !options.configure )
                            return 0;

                        var params      = Array.prototype.slice.call( arguments );

                        shell.cd( module.dirname );

                        grunt.verbose.writeln( 'Execute: ' + 'npm ' + params.join( ' ' ) );

                        return shell.exec( 'npm ' + params.join( ' ' ) ).code === 0;
                    },
                    grunt   : function()
                    {
                        if( !options.compile )
                            return distfile();

                        var params      = Array.prototype.slice.call( arguments );

                        params.push( '--gruntfile=' + gruntfile );

                        grunt.log.subhead( 'Compiling ' + name + ' with ' + ( params.length ?  params.join( ' ' ) : 'no params \n' ) );

                        grunt.verbose.writeln( 'Gruntfile: ' + gruntfile );

                        
                        if( shell.exec( 'grunt ' + params.join( ' ' ) ).code === 0 )
                        {
                            return distfile();
                        };

                        return 'console.error( "Error Grunt Compilation on [ ' + name + ' ]" )';
                    },

                    read    : distfile,

                    data    : distfile()
                });
            })
            ( module.build || function()
            {
                grunt.log.subhead( 'Nothing to compile' );

                return this.data;
            });
        },

        configure       = function( dependencies, options )
        {
            var result  = true;

            und.each( dependencies, function( dep, name )
            {
                if( !clone( name, dep.git, dep.version ) )
                    return result = false;

                patch( name, dep.patches, options );
            });

            return result;
        },

        builder         = function( input, output, options )
        {
            grunt.log.writeln( 'Building file [' + input + '] output [' + output + ']\n' );

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

                    grunt.log.ok( 'Module ' + name  );

                    if( ( lib = options.dependencies[ name ] ) && ( compiled = compile( name, lib, _path ) ) )
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
                    if( configure( build.options.dependencies, build.options ) )
                        grunt.log.ok( 'Configure fails Done [ ' + build_name + ' ]' );
                    else
                        throw new Error( 'Configure fails' );
                }
                else
                {
                    factory();
                }
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