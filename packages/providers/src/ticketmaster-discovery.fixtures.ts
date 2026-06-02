export const typicalTicketmasterResponse = {
  _embedded: {
    events: [
      {
        id: "tm-typical-1",
        name: "Sanitized Arena Concert",
        type: "event",
        url: "https://www.ticketmaster.com/sanitized-arena-concert/event/tm-typical-1",
        locale: "en-us",
        info: "A sanitized fixture event with a venue, classification, date, URL, and prices.",
        images: [
          {
            url: "https://example.invalid/ticketmaster-image.jpg",
            width: 640,
            height: 360
          }
        ],
        dates: {
          start: {
            localDate: "2026-07-10",
            localTime: "23:30:00",
            dateTime: "2026-07-10T23:30:00Z"
          },
          end: {
            dateTime: "2026-07-11T02:30:00Z"
          },
          timezone: "America/New_York",
          status: {
            code: "onsale"
          }
        },
        priceRanges: [
          {
            min: 35,
            max: 95.5,
            currency: "USD"
          }
        ],
        classifications: [
          {
            primary: true,
            segment: {
              id: "KZFzniwnSyZfZ7v7nJ",
              name: "Music"
            },
            genre: {
              id: "KnvZfZ7vAeA",
              name: "Rock"
            },
            subGenre: {
              id: "KZazBEonSMnZfZ7v6F1",
              name: "Alternative Rock"
            }
          }
        ],
        promoter: {
          id: "fixture-promoter",
          name: "Fixture Promoter"
        },
        source: {
          name: "Ticketmaster"
        },
        _embedded: {
          venues: [
            {
              id: "tm-venue-1",
              name: "Fixture Arena",
              timezone: "America/New_York",
              address: {
                line1: "700 Fixture Ave"
              },
              city: {
                name: "Washington"
              },
              state: {
                name: "District of Columbia",
                stateCode: "DC"
              },
              postalCode: "20001",
              images: [
                {
                  url: "https://example.invalid/ticketmaster-venue-image.jpg",
                  width: 640,
                  height: 360
                }
              ],
              location: {
                longitude: "-77.0200",
                latitude: "38.9000"
              }
            }
          ]
        }
      }
    ]
  },
  page: {
    size: 100,
    totalElements: 1,
    totalPages: 1,
    number: 0
  }
};

export const missingPriceTicketmasterResponse = {
  _embedded: {
    events: [
      {
        id: "tm-missing-price-1",
        name: "Sanitized Theater Night",
        url: "https://www.ticketmaster.com/sanitized-theater-night/event/tm-missing-price-1",
        dates: {
          start: {
            dateTime: "2026-08-12T00:00:00Z"
          },
          timezone: "America/New_York",
          status: {
            code: "onsale"
          }
        },
        classifications: [
          {
            primary: true,
            segment: {
              name: "Arts & Theatre"
            },
            genre: {
              name: "Theatre"
            }
          }
        ],
        _embedded: {
          venues: [
            {
              id: "tm-venue-2",
              name: "Fixture Stage",
              city: {
                name: "Alexandria"
              },
              state: {
                stateCode: "VA"
              },
              location: {
                longitude: "-77.0469",
                latitude: "38.8048"
              }
            }
          ]
        }
      }
    ]
  },
  page: {
    size: 100,
    totalElements: 1,
    totalPages: 1,
    number: 0
  }
};

export const unknownClassificationTicketmasterResponse = {
  _embedded: {
    events: [
      {
        id: "tm-unknown-category-1",
        name: "Sanitized Unclassified Event",
        url: "https://www.ticketmaster.com/sanitized-unclassified-event/event/tm-unknown-category-1",
        dates: {
          start: {
            dateTime: "2026-09-15T18:00:00Z"
          },
          timezone: "America/New_York"
        },
        classifications: [
          {
            primary: true,
            segment: {
              name: "Undefined"
            },
            genre: {
              name: "Undefined"
            }
          }
        ],
        _embedded: {
          venues: [
            {
              id: "tm-venue-3",
              name: "Fixture Hall"
            }
          ]
        }
      }
    ]
  },
  page: {
    size: 100,
    totalElements: 1,
    totalPages: 1,
    number: 0
  }
};

export const incompleteVenueTicketmasterResponse = {
  _embedded: {
    events: [
      {
        id: "tm-incomplete-venue-1",
        name: "Sanitized Minimal Venue Event",
        url: "https://www.ticketmaster.com/sanitized-minimal-venue-event/event/tm-incomplete-venue-1",
        dates: {
          start: {
            dateTime: "2026-10-01T17:00:00Z"
          },
          timezone: "America/New_York"
        },
        classifications: [
          {
            primary: true,
            segment: {
              name: "Miscellaneous"
            }
          }
        ],
        _embedded: {
          venues: [
            {
              id: "tm-venue-4",
              name: "Fixture Minimal Venue"
            }
          ]
        }
      }
    ]
  },
  page: {
    size: 100,
    totalElements: 1,
    totalPages: 1,
    number: 0
  }
};
