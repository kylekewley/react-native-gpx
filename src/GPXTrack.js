
export default class GPXTrack {
  constructor(track) {
    this.track = track;
    this.trackInfo = undefined;
  }

  /**
   * Get the name of the track. Returns undefined if the name is not
   * defined in the gpx file
   */
  getName() {
    let nameNode = this.track.find('ns:name', GPXTrack.GPX_NS);

    if (nameNode.length === 0) return undefined;

    return nameNode[0].text();
  }

  async getPointAtDistance(segIdx, dist) {
    let segInfo = await this.loadAllSegmentInfo();

    if (segIdx >= segInfo.length) {
      throw new Error(`There is no track segment at index ${segIdx}`);
    }

    return this._getPointAtDistance(segInfo[segIdx].points, dist);
  }

  async loadAllSegmentInfo() {
    if (this.trackInfo !== undefined)
      return this.trackInfo;

    let segments = await this._getTrackSegments();
    if (segments === undefined) throw new Error('Unable to find track segments');

    this.trackInfo =  await Promise.all(segments.map(this._loadSegmentInfo.bind(this)));

    return this.trackInfo;
  }

  _getPointAtDistance(ptArray, distance) {
    if (ptArray.length === 0) throw new Error('Point array must have at least one element');

    let upperBound = ptArray.length - 1;
    let lowerBound = 0;
    let searchIndex = Math.floor(upperBound / 2);

    // Loop until lowerBound is one index below upperBound
    while (lowerBound + 1 < upperBound) {
      // Search point is too far on the path
      if (ptArray[searchIndex].distance > distance) {
        upperBound = searchIndex;
      }else if (ptArray[searchIndex].distance < distance) {
        lowerBound = searchIndex;
      }else if (ptArray[searchIndex].distance === distance) {
        // Found an exact match
        lowerBound = upperBound = searchIndex;
      }

      searchIndex = Math.floor((upperBound - lowerBound) / 2 + lowerBound);
    }

    // We now have two points. Find out which one is closest
    if (distance < ptArray[lowerBound].distance || distance > ptArray[upperBound].distance) {
      throw new Error('Distance is out of bounds of point array');
    }

    let distanceFromLower = distance - ptArray[lowerBound].distance;
    let distanceFromUpper = ptArray[upperBound].distance - distance;

    if (distanceFromLower < distanceFromUpper) return lowerBound;
    return upperBound;
  }

  _getSurroundingPoints(ptArray, distance) {
  }

  async _loadSegmentInfo(segment) {
    let points = segment.find('ns:trkpt', GPXTrack.GPX_NS);

    let distAcc = {
      totalDistance: 0.0,
      lastCartesianPoint: undefined
    };

    let eleAcc = {
      totalElevationGain: 0.0,
      totalElevationLoss: 0.0,
      previousElevation: undefined
    };

    points.forEach(trkpt => {
      let pointData = this._coordinateDataFromTrackPoint(trkpt);

      distAcc = this._accumulateTrackLength(distAcc, pointData);
      eleAcc = this._accumulateTrackElevation(eleAcc, pointData);

      // Cache the values with the track point
      trkpt.distance = distAcc.totalDistance;
      trkpt.totalGain = eleAcc.totalElevationGain;
      trkpt.totalLoss = eleAcc.totalElevationLoss;
    });

    return {
      points: points,
      totalDistance: distAcc.totalDistance,
      totalElevationGain: eleAcc.totalElevationGain,
      totalElevationLoss: eleAcc.totalElevationLoss
    };
  }


  async _getTrackSegments() {
    return this.track.find('ns:trkseg', GPXTrack.GPX_NS);
  }

  _accumulateTrackLength(acc, currentPoint) {
    // Convert the lat/lon/alt to a cartesian coordinate system
    let currentCartesianPoint = this._toCartesianPoints(currentPoint);

    // Calculate the distance from the previous point and current point
    distance = this._segmentDistance(acc.lastCartesianPoint, currentCartesianPoint);

    // Add the distance to the value in the accumulator
    acc.totalDistance += distance;
    // Set the last point in the accumulator for the next run
    acc.lastCartesianPoint = currentCartesianPoint;

    // Return the updated accumulator for the next run
    return acc;
  }

  _accumulateTrackElevation(acc, currentPoint) {
    // Get the elevation in meters from the third position of the current coordinate
    let currentElevation = currentPoint[2];

    if (acc.previousElevation !== undefined) {
      // Get the difference in elevation from the previous value in the accumulator
      let diff = currentElevation - acc.previousElevation;

      // Gained elevation
      if (diff >= 0) {
        acc.totalElevationGain += diff;
      }else {
        // Lossed elevation. Subtract because diff is negative
        acc.totalElevationLoss -= diff;
      }
    }

    acc.previousElevation = currentElevation;

    return acc
  }

  /**
   * Returns an array [lat, lon, altitude]
   */
  _coordinateDataFromTrackPoint(trkpt) {
    let lat = parseFloat(trkpt.attr('lat').value());
    let lon = parseFloat(trkpt.attr('lon').value());
    let alt = 0.0;

    var altNode = trkpt.find('ns:ele', GPXTrack.GPX_NS);

    if (altNode !== undefined && altNode.length !== 0) {
      let tmp = parseFloat(altNode[0].text());
      if (!isNaN(tmp)) {
        alt = tmp;
      }
    }

    return [lat, lon, alt];
  }

  /**
   * Takes the [latitude, longitude, altitude] as pointData and converts
   * them to catesian points. Returns an array [x, y, z]
   */
  _toCartesianPoints(pointData) {
    var lat = pointData[0];
    var lon = pointData[1];
    var alt = pointData[2];

    const DEG_TO_RAD = Math.PI / 180.0;
    var cosLat = Math.cos(lat * DEG_TO_RAD);
    var sinLat = Math.sin(lat * DEG_TO_RAD);
    var cosLon = Math.cos(lon * DEG_TO_RAD);
    var sinLon = Math.sin(lon * DEG_TO_RAD);
    var rad = 6378137.0;
    var f = 1.0 / 298.257224;
    var C = 1.0 / Math.sqrt(cosLat * cosLat + (1 - f) * (1 - f) * sinLat * sinLat);
    var S = (1.0 - f) * (1.0 - f) * C;

    let x = (rad * C + alt) * cosLat * cosLon;
    let y = (rad * C + alt) * cosLat * sinLon;
    let z = (rad * S + alt) * sinLat;

    return [x, y, z];
  }

  /**
   * Takes the cartesian points in R_3 and returns a distance value.
   * returns zero if pt1 or pt2 is undefined.
   */
  _segmentDistance(pt1, pt2) {
    if (pt1 === undefined || pt2 === undefined) {
      return 0;
    }
    return Math.sqrt(Math.pow(pt2[0] - pt1[0], 2) + Math.pow(pt2[1] - pt1[1], 2) + Math.pow(pt2[2] - pt1[2], 2));
  }
}
GPXTrack.GPX_NS = { ns: 'http://www.topografix.com/GPX/1/1' };
