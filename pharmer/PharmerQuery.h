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
 * PharmerQuery.h
 *
 *  Created on: Aug 5, 2010
 *      Author: dkoes
 *
 *      Class for reading, storing, manipulating, and performing queries.
 *      Designed for both synchronous and asynchroous querying.
 */

#ifndef PHARMERQUERY_H_
#define PHARMERQUERY_H_

#include "cors.h"
#include <iostream>
#include <ctime>
#include <vector>
#include <boost/thread.hpp>
#include <boost/asio.hpp>
#include <boost/tuple/tuple.hpp>
#include <boost/shared_ptr.hpp>
#include <boost/unordered_set.hpp>
#include <json/json.h>
#include "Triplet.h"
#include "tripletmatching.h"
#include "params.h"
#include "Excluder.h"
#include "pharmarec.h"
#include "pharmerdb.h"

typedef boost::shared_ptr<boost::asio::ip::tcp::iostream> stream_ptr;

using namespace std;

//stores additional cache info (name)
#define QR_NAME_SIZE 32
struct QueryResult
{
	const CorrespondenceResult *c;

	//extras; optional
	char name[QR_NAME_SIZE];

	QueryResult() : c(NULL)
	{
		memset(name,0,QR_NAME_SIZE);
	}

	QueryResult(const CorrespondenceResult *c): c(c)
	{
		memset(name,0,QR_NAME_SIZE);
	}
};

struct MolWeightDatabase
{
	double min; // >=
	double max; // <
	boost::shared_ptr<PharmerDatabaseSearcher> db;

	MolWeightDatabase(boost::shared_ptr<PharmerDatabaseSearcher> d, double _min): min(_min), max(HUGE_VAL), db(d)
	{

	}
	MolWeightDatabase(): min(0), max(0) {}

	bool overlapsRange(double minR, double maxR) const
	{
		return minR < max && maxR >= min;
	}
};


class PharmerQuery
{
	string errorStr;
	vector< vector<MolWeightDatabase> > databases;

	vector<PharmaPoint> points;
	vector<QueryTriplet> triplets; //all n^3 triangles
	boost::multi_array<unsigned, 3> tripIndex; //for any (i,j,k), the index of the corresponding triplet
	QueryParameters params;
	Excluder excluder;

	bool valid;
	bool stopQuery;

	boost::thread *tripletMatchThread; //performs triplet matching
	time_t lastAccessed;

	MTQueue<unsigned> dbSearchQ;

	CorAllocator coralloc;
	vector<MTQueue<CorrespondenceResult*> > corrsQs;
	BumpAllocator<1024*1024> resalloc;
	vector<QueryResult*> results;
	SortTyp currsort;

	unsigned nthreads;
	unsigned dbcnt;

	SpinMutex mutex; //for accessing results
	int inUseCnt;


	//smina data
	unsigned sminaid; //id of smina minimization

	string sminaServer; //store these so we can cancel
	string sminaPort;

	static void thread_tripletMatches(PharmerQuery *query);
	static void thread_tripletMatch(PharmerQuery *query);

	void generateQueryTriplets(PharmerDatabaseSearcher& pharmdb, vector<vector<
			QueryTriplet> >& trips);
	void loadResults();
	void checkThreads();

	void setExtraInfo(QueryResult& r);

	void initializeTriplets();

	void sortResults(SortTyp srt, bool reverse);
	void reduceResults();

	bool isExcluded(QueryResult* result);

	unsigned dbID(unsigned db, unsigned i) const
	{
		return i*databases.size() + db;
	}

	void dbCoords(unsigned dbid, unsigned& db, unsigned& i) const
	{
		db = dbid % databases.size();
		i = dbid / databases.size();
	}

	unsigned maxID() const
	{
		return dbcnt;
	}

	unsigned long getLocation(const QueryResult* r,boost::shared_ptr<PharmerDatabaseSearcher>& db);

	static void thread_sendSmina(PharmerQuery *query, stream_ptr out, unsigned max);

public:
	//input stream and format specified as extension
	PharmerQuery(const vector< vector<MolWeightDatabase> >& dbs,
			istream& in, const string& ext, const QueryParameters& qp =
					QueryParameters(), unsigned nth =
					boost::thread::hardware_concurrency());

	PharmerQuery(const vector< vector<MolWeightDatabase> >& dbs,
			const vector<PharmaPoint>& pts, const QueryParameters& qp =
					QueryParameters(), const Excluder& ex = Excluder(), unsigned nth = 1);

	virtual ~PharmerQuery();

	bool isValid(string& msg) const
	{
		msg = errorStr;
		return valid;
	}

	void execute(bool block = true);

	//all of the result/output functions can be called while an asynchronous
	//query is running

	unsigned numResults() { loadResults(); return results.size(); }
	//return all current results
	void getResults(const DataParameters& dp, vector<QueryResult*>& out);
	//output text result of query (correspondences)
	void outputData(const DataParameters& dp, ostream& out, bool jsonHeader =
			false);
	//write out all results in sdf format - NOT sorted
	void outputMols(ostream& out);
	//output single mol in sdf format
	void outputMol(const QueryResult* mol, ostream& out, bool minimize = false);
	void outputMol(unsigned index, ostream& out, bool jsonHeader, bool minimize = false);

	void getZINCIDs(vector<unsigned>& ids);
	//attempt to cancel, non-blocking, query neest time to wrap up
	void cancel();
	bool finished(); //okay to deallocate, user may still care though
	bool cancelled() { return stopQuery; } //user no longer cares
	void access()
	{
		lastAccessed = time(NULL);
		stopQuery = false;
	}
	const time_t idle()
	{
		return time(NULL) - lastAccessed;
	} //time since last access

	//return true if can read ext formatted file
	static bool validFormat(const string& ext);
	void print(ostream& out) const;

	//for asynchronous access, keep a usecnt to prevent deallocating something
	//that is in use
	void decrementUseCnt()
	{
		__sync_fetch_and_sub(&inUseCnt, 1);
	}
	void incrementUseCnt()
	{
		__sync_fetch_and_add(&inUseCnt, 1);
	}
	int inUse()
	{
		return inUseCnt;
	}

	const vector<PharmaPoint>& getPoints() const { return points; }

	bool inRange(unsigned i, unsigned j, unsigned p, double minip, double maxip, double minjp, double maxjp) const;

	//smina functions
	unsigned getSminaID() const
	{
		return sminaid;
	}


	//send results smina data, with reorient data, to out
	void sendSminaResults(const string& s, const string& p, stream_ptr out, unsigned sid, unsigned max)
	{
		sminaServer = s;
		sminaPort = p;
		sminaid = sid;
		boost::thread th(thread_sendSmina, this, out, max); //should detach on destruct
	}
};

#endif /* PHARMERQUERY_H_ */
