module.exports = function( grunt ) 
{
    var und             = grunt.util._,

        path            = require( 'path' ),

        doc             = require( './deps/docgram.js')( grunt ),

        syn             = require( './deps/syntax.js')( grunt ),

        cmp             = require( './deps/compile' )( grunt );

    grunt.registerMultiTask( 'jass', 'Compiling javascript files.', function( target ) 
    {        
        var config          = grunt.config( 'jass' ),

            done            = this.async(),

            flags           = this.flags,

            optIn           = flags[ "*" ];

        und.each( config, function( _build, _build_name_ ) 
        {
            grunt.log.subhead( 'Checking [ ' + _build_name_ + ' ] build' );

            _build.files     = _build.files || {};

            _build.options   = _build.options || {};

            _build.options.flags = 
            ({
                'version'           : 'v0.1',

                'name'              : 'ueScript',

                'cname'             : 'ue',

                'debug'             : grunt.config.data.pkg.debug || false
            });

            und.each( _build.files, function( output, source )
            {
                cmp.build( path.resolve( source ), path.resolve( output ), _build.options );

                doc.build( _build.options, function( results )
                {
                    //syn.syn( syntax, _build.options );
                });
            });
            
        });
        
        done();
    });
}