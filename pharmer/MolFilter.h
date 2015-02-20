/*
Pharmer: Efficient and Exact 3D Pharmacophore Search
Copyright (C) 2011  David Ryan Koes and the University of Pittsburgh

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/

/*
 * MolFilter.h
 *
 *  Created on: Jan 28, 2011
 *      Author: dkoes
 */

#ifndef MOLFILTER_H_
#define MOLFILTER_H_

#include <openbabel/mol.h>
using namespace std;

//base class for specifying to creator to skip certain mols
class MolFilter {
public:
	virtual bool skip(OpenBabel::OBMol& mol) = 0;

};

class WeightRangeFilter: public  MolFilter
{
	double min;
	double max;
public:
	WeightRangeFilter():min(0),max(HUGE_VAL) {}

	WeightRangeFilter(double min_, double max_): min(min_), max(max_)
	{

	}

	bool badWeight(double weight)
	{
		if(weight < min)
			return true;
		if(weight >= max)
			return true;
		return false;
	}
	//include min, not max
	bool skip(OpenBabel::OBMol& mol)
	{
		return badWeight(mol.GetMolWt());
	}

};


#endif /* MOLFILTER_H_ */
