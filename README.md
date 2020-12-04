Scrape clay county library website for loan information.

    yarn
    yarn start

The following environment variables are required:

    LIBRARY_USERNAME
    LIBRARY_PASSWORD

Sample output:

    [
      {
        "name": "<My Info>",
        "id": "0",
        "books": [
          {
            "title": "The lump of coal",
            "dueDate": "12/15/2020"
          },
          {
            "title": "Librarian's night before Christmas",
            "dueDate": "12/15/2020"
          },
          {
            "title": "Slugs in love",
            "dueDate": "12/15/2020"
          },
        ]
      },
      {
        "name": "Nauman, R",
        "id": "1",
        "books": []
      },
      {
        "name": "Nauman, R2",
        "id": "2",
        "books": []
      }
    ]
