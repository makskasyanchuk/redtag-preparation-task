public with sharing class BookManagementController {
    public class BookWrapper {
        public BookWrapper() {}

        @AuraEnabled
        public String name;
        @AuraEnabled
        public String recordId;
        @AuraEnabled
        public String authorId;
        @AuraEnabled
        public String description;
        @AuraEnabled
        public String authorName;


    }

    @AuraEnabled(cacheable=true)
    public static List<BookWrapper> getAllBooks() {
        List<Book__c> books = [
            SELECT Id, Name, Author__c, Author__r.Name, Description__c, CreatedDate
            FROM Book__c WHERE Author__c != null ORDER BY Name LIMIT 50
        ];
        List<BookWrapper> wrappers = new List<BookWrapper>();
        for (Book__c book : books) {
            BookWrapper wrapper = new BookWrapper();
            wrapper.recordId = book.Id;
            wrapper.name = book.Name;
            wrapper.description = book.Description__c;
            wrapper.authorId = book.Author__c;
            wrapper.authorName = book.Author__r.Name;

            wrappers.add(wrapper);
        }
        return wrappers;
    }

    @AuraEnabled(cacheable=true)
    public static List<Author__c> getAllAuthors() {
        return [SELECT Id, Name FROM Author__c ORDER BY Name LIMIT 50];
    }

    @AuraEnabled
    public static Book__c upsertBook(Id bookId, String name, String description, Id authorId) {
        Book__c book = new Book__c(
            Id = bookId,
            Name = name,
            Description__c = description,
            Author__c = authorId
        );

        upsert book;
        return book;
    }

    @AuraEnabled
    public static void deleteBook(Id bookId) {
        Database.delete(bookId);
    }

    @AuraEnabled
    public static void insertAuthor(String name) {
        insert new Author__c(
            Name = name
        );
    }

    @AuraEnabled
    public static void deleteAuthorAndRelatedBooks(Id authorId) {
        Database.delete(authorId);
    }
}