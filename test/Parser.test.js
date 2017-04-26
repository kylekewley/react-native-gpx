import Parser from '../src/Parser';

test('Test parser constructor', () => {
  let parser = new Parser();
  let testString = '<test>hi</test>';

  let parsedXML = parser.parseXMLString(testString);
  let root = parsedXML.root();

  expect(root.text()).toBe('hi');
  expect(root.name()).toBe('test');
});
