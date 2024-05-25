//
// Copyright (C) 2016 Jonathon Love
//

#ifndef DATASET_H
#define DATASET_H

#include <string>

#include "memorymap.h"
#include "column.h"

typedef struct
{
    int volatile columnCount; // columns used
    int volatile rowCount;
    ColumnStruct ** volatile columns;
    int volatile capacity;  // size of columns array
    int volatile nextColumnId;
    ColumnStruct * volatile scratch;
    int volatile rowCountExFiltered;
    ColumnStruct * volatile indices;
    int volatile weights;

} DataSetStruct;

class DataSet
{
public:

    static DataSet *retrieve(MemoryMap *mm);

    int rowCount() const;
    int columnCount() const;

    bool isRowFiltered(int index) const;
    int rowCountExFiltered() const;
    int getIndexExFiltered(int index);

    Column operator[](int index);
    Column operator[](const char *name);
    Column getColumnById(int id);
    bool hasWeights();
    Column weights();
    const char* weightsName();

protected:

    DataSet(MemoryMap *memoryMap);
    DataSetStruct *struc() const;
    ColumnStruct *strucC(int index) const;
    Column indices();

    DataSetStruct *_rel;

private:

    MemoryMap *_mm;

};

#endif // DATASET_H
