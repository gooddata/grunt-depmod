module.exports = function(grunt) {
    grunt.initConfig({
        run: {
            testjest: {
                options: {
                    wait: true
                },
                cmd: "jest",
                args: [
                    'test/test.js'
                ]
            },
        },
        depmod: {
            test: {
                src: 'test/fixtures/**/*.js',
                dest: 'test/fixtures/result.depmod.json'
            }
        }
    });

    grunt.loadNpmTasks('grunt-run');

    grunt.loadTasks('tasks');

    grunt.registerTask('test', ['depmod:test', 'run:testjest']);

    // Default task.
    grunt.registerTask('default', 'test');
};
