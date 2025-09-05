# Required Firestore Indexes for StudySphere

This document lists all the composite indexes required for optimal Firestore performance in StudySphere.

## Why Indexes Are Needed

Firestore requires composite indexes for queries that:
- Use multiple `where()` clauses
- Combine `where()` with `orderBy()`
- Use `array-contains` with other filters

## Required Indexes

### 1. Passages Collection

**Index 1: Subject + Published + Created Date**
```
Collection: passages
Fields: 
  - subject (Ascending)
  - isPublished (Ascending) 
  - createdAt (Descending)
```

**Index 2: Published + Created Date (for all subjects)**
```
Collection: passages
Fields:
  - isPublished (Ascending)
  - createdAt (Descending)
```

### 2. Attempts Collection

**Index 1: User + Subject + Attempted Date**
```
Collection: attempts
Fields:
  - userId (Ascending)
  - subject (Ascending)
  - attemptedAt (Descending)
```

**Index 2: User + Attempted Date (for all subjects)**
```
Collection: attempts
Fields:
  - userId (Ascending)
  - attemptedAt (Descending)
```

**Index 3: User + Passage + Attempted Date**
```
Collection: attempts
Fields:
  - userId (Ascending)
  - passageId (Ascending)
  - attemptedAt (Descending)
```

## How to Create Indexes

### Method 1: Firebase Console (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to Firestore Database
4. Click on "Indexes" tab
5. Click "Create Index"
6. Add the fields as specified above

### Method 2: Automatic Creation

When you run queries that need indexes, Firestore will show an error with a direct link to create the required index. Look for console errors like:

```
The query requires an index. You can create it here: https://console.firebase.google.com/...
```

Click the link to automatically create the index.

### Method 3: Firebase CLI

Create a `firestore.indexes.json` file:

```json
{
  "indexes": [
    {
      "collectionGroup": "passages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "subject", "order": "ASCENDING" },
        { "fieldPath": "isPublished", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "passages", 
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isPublished", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "attempts",
      "queryScope": "COLLECTION", 
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "subject", "order": "ASCENDING" },
        { "fieldPath": "attemptedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "attempts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "attemptedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "attempts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "passageId", "order": "ASCENDING" },
        { "fieldPath": "attemptedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Then deploy with:
```bash
firebase deploy --only firestore:indexes
```

## Performance Tips

1. **Always use `limit()`**: Every query should have a reasonable limit (12-50 items)
2. **Use pagination**: Implement `startAfter()` for large datasets
3. **Order by indexed fields**: Always `orderBy()` fields that are in your composite indexes
4. **Monitor usage**: Check Firestore usage in Firebase Console to optimize queries

## Query Examples

Here are the optimized queries used in the app:

### Get Published Passages by Subject
```javascript
const q = query(
  collection(db, 'passages'),
  where('subject', '==', subject),
  where('isPublished', '==', true),
  orderBy('createdAt', 'desc'),
  limit(12)
);
```

### Get User Attempts
```javascript
const q = query(
  collection(db, 'attempts'),
  where('userId', '==', userId),
  orderBy('attemptedAt', 'desc'),
  limit(20)
);
```

### Get User Attempts by Subject
```javascript
const q = query(
  collection(db, 'attempts'),
  where('userId', '==', userId),
  where('subject', '==', subject),
  orderBy('attemptedAt', 'desc'),
  limit(20)
);
```

## Index Status

You can check if your indexes are ready in the Firebase Console:
- 🟢 **Ready**: Index is built and ready to use
- 🟡 **Building**: Index is being created (can take several minutes)
- 🔴 **Error**: Index creation failed

## Troubleshooting

**Q: Query is slow even with indexes**
A: Check that you're using `limit()` and that your `orderBy()` field is the last field in your composite index.

**Q: "Index not found" error**
A: Make sure the index fields match exactly with your query fields and their order.

**Q: Too many indexes**
A: Each index costs storage. Remove unused indexes from Firebase Console.

**Q: Index creation failed**
A: Check that field names are correct and that you have sufficient permissions.