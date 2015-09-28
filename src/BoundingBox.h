/*
Pharmit
Copyright (c) David Ryan Koes, University of Pittsburgh and contributors.
All rights reserved.

Pharmit is licensed under both the BSD 3-clause license and the GNU
Public License version 2. Any use of the code that retains its reliance
on the GPL-licensed OpenBabel library is subject to the terms of the GPL2.

Use of the Pharmit code independently of OpenBabel (or any other
GPL2 licensed software) may choose between the BSD or GPL licenses.

See the LICENSE file provided with the distribution for more information.

*/

/*
 * BoundingBox.h
 *
 *  Created on: Aug 2, 2010
 *      Author: dkoes
 */

#ifndef PHARMITSERVER_BOUNDINGBOX_H_
#define PHARMITSERVER_BOUNDINGBOX_H_

#include <boost/tuple/tuple.hpp>
#include <boost/tuple/tuple_comparison.hpp>
#include <cstdlib>
#include <climits>
#include <iostream>

using namespace std;

enum SplitType
{
	NoSplit,
	SplitXFixed, //split by a fixed amount along x axis
	SplitYFixed, //y axis
	SplitZFixed,
//z axis
};

typedef boost::tuple<int, int, int> TripleInt;

//maintain a bounding box
struct BoundingBox
{
	unsigned short minx;
	unsigned short maxx;
	unsigned short miny;
	unsigned short maxy;
	unsigned short minz;
	unsigned short maxz;

	BoundingBox() :
		minx(USHRT_MAX), maxx(0), miny(USHRT_MAX), maxy(0), minz(USHRT_MAX), maxz(0)
	{
	}

	void update(const TripleInt& ijk)
	{
		update(ijk.get<0>(), ijk.get<1>(), ijk.get<2>());
	}

	void update(unsigned short x, unsigned short y, unsigned short z)
	{
		if (x < minx)
			minx = x;
		if (x > maxx)
			maxx = x;
		if (y < miny)
			miny = y;
		if (y > maxy)
			maxy = y;
		if (z < minz)
			minz = z;
		if (z > maxz)
			maxz = z;
	}

	double volume() const
	{
		return (double)(maxx-minx)*(maxy-miny)*(maxz-minz);
	}

	void setX(unsigned short min, unsigned short max)
	{
		minx = min;
		maxx = max;
	}

	void setY(unsigned short min, unsigned short max)
	{
		miny = min;
		maxy = max;
	}

	void setZ(unsigned short min, unsigned short max)
	{
		minz = min;
		maxz = max;
	}

	//return true if the passed ranges overlap
	static bool hasOverlap(double min1, double max1, double min2, double max2)
	{
		if (min1 <= max2 && min1 >= min2)
			return true;
		if (max1 <= max2 && max1 >= min2)
			return true;
		if (min2 <= max1 && min2 >= min1)
			return true; //fully contained
		return false;
	}

	//return true if this overlaps with x
	bool hasOverlap(const BoundingBox& x) const
	{
		if (hasOverlap(minx, maxx, x.minx, x.maxx)
				&& hasOverlap(miny, maxy, x.miny, x.maxy)
				&& hasOverlap(minz, maxz, x.minz, x.maxz))
			return true;
		return false;
	}

	//return true if this is fully contained within x
	bool containedIn(const BoundingBox& x) const
	{
		if(minx < x.minx) return false;
		if(maxx > x.maxx) return false;
		if(miny < x.miny) return false;
		if(maxy > x.maxy) return false;
		if(minz < x.minz) return false;
		if(maxz > x.maxz) return false;

		return true;
	}

	//return true if passed split bisects box
	bool planeInBox(SplitType split, unsigned short splitVal) const
	{
		switch (split)
		{
		case SplitXFixed:
			return splitVal > minx && splitVal < maxx;
		case SplitYFixed:
			return splitVal > miny && splitVal < maxy;
		case SplitZFixed:
			return splitVal > minz && splitVal < maxz;
		default:
			abort();
		}
	}

	//narrow along a single dimension
	void narrow(SplitType split, unsigned short min, unsigned short max)
	{
		switch(split)
		{
		case SplitXFixed:
			minx = min;
			maxx = max;
			break;
		case SplitYFixed:
			miny = min;
			maxy = max;
			break;
		case SplitZFixed:
			minz = min;
			maxz = max;
			break;
		default:
			break;
		}
	}

	friend ostream& operator<<(ostream& out, const BoundingBox& box);
};

#endif /* PHARMITSERVER_BOUNDINGBOX_H_ */
