var fs = require('fs');

import GPXDocument from '../src/GPXDocument';


function loadXMLFile(path) {
  var data = fs.readFileSync(path, 'utf8');

  return data;
}

const xsd = loadXMLFile('./test/gpxfiles/gpx.xsd.xml');
const ElCap = loadXMLFile('./test/gpxfiles/ElCap.gpx');
const Trestle = loadXMLFile('./test/gpxfiles/Trestle.gpx');
const CASectionA = loadXMLFile('./test/gpxfiles/CA_Sec_A_tracks.gpx');

/////// TESTS ///////

test('Test parser constructor', () => {
  let testString = '<test>hi</test>';
  let gpx = new GPXDocument(testString);

  let root = gpx.parsedGPX.root();

  expect(root.text()).toBe('hi');
  expect(root.name()).toBe('test');
});

test('Validate xml file', () => {
  let gpx = new GPXDocument(ElCap);
  let gpxxsd = new GPXDocument(xsd);

  expect(gpx.parsedGPX.validate(gpxxsd.parsedGPX)).toBe(true);
});

it('Get track names', () => {
  let sectionA = new GPXDocument(CASectionA);

  return sectionA.getTracks().then(data => {
    expect(data.map(trk => trk.getName())).toEqual(['CA Sec A',
      'CA Sec A - 3rd Gate Trail',
      'CA Sec A - CRHT Trail',
      'CA Sec A - Chariot Canyon Road',
      'CA Sec A - Kitchen Creek Falls Trail',
      'CA Sec A - Rodriguez Spring Road',
      'CA Sec A - Sunrise Trailhead Trail'
    ]);
  });
});

test('Get segment lengths', async () => {
  let sectionA = new GPXDocument(CASectionA);
  let track = await sectionA.getTracks();

  let segLength = (await track[0].loadAllSegmentInfo())[0];
  let segLength2 = (await track[1].loadAllSegmentInfo())[0];

  expect(Math.floor(segLength.totalDistance/1000)).toEqual(168);
  expect(Math.floor(segLength.totalElevationGain)).toEqual(6215);
  expect(Math.floor(segLength.totalElevationLoss)).toEqual(6176);

  expect(Math.floor(segLength2.totalDistance)).toEqual(915);
  expect(Math.floor(segLength2.totalElevationGain)).toEqual(7);
  expect(Math.floor(segLength2.totalElevationLoss)).toEqual(67);
});

test('Get nearest coordinate from distance', async () => {
});
