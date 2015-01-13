module.exports = function( grunt ) 
{
    var und             = grunt.util._,

        path            = require( 'path' ),

        scope           = 
        [
            "text.js - source - meta.tag, punctuation.definition.tag.begin"
        ],

        completions     = 
        [

        ],

        build           = function( modules )
        {

        },

        parse           = function( modules  )
        {
            und.each( modules, function( methods, module_name )
            {
                und.each( methods, function( method, method_key )
                {
                    und.each( method.overloads, function( overload, overload_key )
                    {
                        completions.push({ "trigger" : 'ue.' + overload.syntax, "contents": 'ue.' + overload.syntax })
                    });
                });
            });

            grunt.file.write( '/Users/ruben.lopez/Enviroment/deploy/ueScript/dist/ue-script.sublime-completions', JSON.stringify({ scope : scope, completions : completions }, null, 4 ) )
        };

    return ({ build : build, parse : parse });
}