var grunt = require('grunt'),
    depmod = require('../tasks/depmod');

describe('Obtain a JS file dependency', function() {
  var result, expected;

  beforeEach(function() {
      result   = grunt.file.read('test/fixtures/result.depmod.json'),
      expected = grunt.file.read('test/fixtures/expected.depmod.json');
  });

  it('depmod works...', function() {
    expect(result).toEqual(expected);
  });
});
