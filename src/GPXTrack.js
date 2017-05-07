var geolib = require('geolib');

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

  async loadAllSegmentInfo() {
    if (this.trackInfo !== undefined)
      return this.trackInfo;

    let segments = this._getTrackSegments();
    if (segments === undefined) throw new Error('Unable to find track segments');

    this.trackInfo =  await Promise.all(segments.map(this._loadSegmentInfo.bind(this)));

    return this.trackInfo;
  }

  async getPointAtDistance(dist, segIdx) {
    let segInfo = await this.loadAllSegmentInfo();

    if (segIdx >= segInfo.length) {
      throw new Error(`There is no track segment at index ${segIdx}`);
    }

    return this._getPointAtDistance(dist, segInfo[segIdx].points);
  }

  /**
   * Find the nearest coordinate index from the given lat/lon.
   * If segIdx is undefined, all segments will be searched.
   * @return  Number index if segIdx is defined. Array of indexes if segIdx is undefined
   */
  async findNearestInTrack(latlon, segIdx=undefined) {
    let segInfo = await this.loadAllSegmentInfo();

    if (segIdx !== undefined) {
      // Throw an error if the index is out of bounds
      if (segIdx >= segInfo.length) throw new Error(`There is no track segment at index ${segIdx}`);

      // set the segInfo to an array of one
      segInfo = [segInfo[segIdx]];
    }

    let nearest = await Promise.all(segInfo.map(async segInfo => await this._findNearestInSegment(latlon, segInfo.points)));

    // Unwrap the only value index value if segIdx is defined
    if (segIdx) nearest = nearest[0];

    return nearest;
  }

  async _findNearestInSegment(latlon, points) {
    return geolib.findNearest(latlon, points, 0, 1);
  }

  _getPointAtDistance(distance, ptArray) {
    // We now have two points. Find out which one is closest
    let [lowerBound, upperBound] = this._getSurroundingPoints(distance, ptArray);

    let lowPoint = ptArray[lowerBound];
    let highPoint = ptArray[upperBound];
    let distanceFromLower = distance - lowPoint.distance;
    let distanceFromUpper = ptArray[upperBound].distance - distance;

    let estimatedCoordinate = undefined;
    if (lowPoint === highPoint) {
      estimatedCoordinate = lowCoord;
    }else {
      let distanceBetween = geolib.getDistance(lowPoint, highPoint);
      let percentAfter = distanceFromLower / distanceBetween;

      let coordDiff = [highPoint[0] - lowPoint[0], highPoint[1] - lowPoint[1], highPoint[2] - lowPoint[2]];
      estimatedCoordinate = [
        coordDiff[0] * percentAfter + lowPoint[0],
        coordDiff[1] * percentAfter + lowPoint[1],
        coordDiff[2] * percentAfter + lowPoint[2]
      ];
    }


    let closest = distanceFromLower < distanceFromUpper ? lowerBound : upperBound;

    return { closestPointIndex: closest,
      estimatedCoordinate
    };
  }

  _getSurroundingPoints(distance, points) {
    if (points.length === 0) throw new Error('Point array must have at least one element');

    let upperBound = points.length - 1;
    let lowerBound = 0;
    let searchIndex = Math.floor(upperBound / 2);

    // Loop until lowerBound is one index below upperBound
    while (lowerBound + 1 < upperBound) {
      // Search point is too far on the path
      if (points[searchIndex].distance > distance) {
        upperBound = searchIndex;
      }else if (points[searchIndex].distance < distance) {
        lowerBound = searchIndex;
      }else if (points[searchIndex].distance === distance) {
        // Found an exact match
        lowerBound = upperBound = searchIndex;
      }

      searchIndex = Math.floor((upperBound - lowerBound) / 2 + lowerBound);
    }

    if (distance < points[lowerBound].distance || distance > points[upperBound].distance) {
      throw new Error('Distance is out of bounds of point array');
    }

    return [lowerBound, upperBound];
  }

  async _loadSegmentInfo(segment) {
    let points = segment.find('ns:trkpt', GPXTrack.GPX_NS);
    let coordList = points.map(this._coordinateDataFromTrackPoint);

    let firstPoint = points.length > 0 ? coordList[0] : undefined;

    let distAcc = {
      totalDistance: 0.0,
      lastPoint: firstPoint
    };

    let eleAcc = {
      totalElevationGain: 0.0,
      totalElevationLoss: 0.0,
      previousElevation: firstPoint[2]
    };

    coordList.forEach(pointData => {
      distAcc = this._accumulateTrackLength(distAcc, pointData);
      eleAcc = this._accumulateTrackElevation(eleAcc, pointData);

      // Cache the values with the track point
      pointData.distance = distAcc.totalDistance;
      pointData.totalGain = eleAcc.totalElevationGain;
      pointData.totalLoss = eleAcc.totalElevationLoss;
    });

    return {
      points: coordList,
      totalDistance: distAcc.totalDistance,
      totalElevationGain: eleAcc.totalElevationGain,
      totalElevationLoss: eleAcc.totalElevationLoss
    };
  }


  _getTrackSegments() {
    return this.track.find('ns:trkseg', GPXTrack.GPX_NS);
  }

  _accumulateTrackLength(acc, currentPoint) {
    // Calculate the distance from the previous point and current point
    distance = geolib.getDistance(acc.lastPoint, currentPoint);

    // Add the distance to the value in the accumulator
    acc.totalDistance += distance;
    // Set the last point in the accumulator for the next run
    acc.lastPoint = currentPoint;

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

    return [lon, lat, alt];
  }

}
GPXTrack.GPX_NS = { ns: 'http://www.topografix.com/GPX/1/1' };
