const LoadConstants = {
    //API FAILURE LOG
    SEARCHLOAD_LOG: "Searchload API:",
    MYLOADS_LOG: "Myloads API:",
    LOADDETAILS_LOG: "Load Details API:",
    PUBLISHLOAD_LOG: "Publish load API:",
    UPDATELOAD_LOG: "Update load API:",
    CANCELLOAD_LOG: "Cancel load API:",
    DELETELOAD_LOG: "Delete load API:",

    // searchload constants
    LOADS_LIMIT: 10,
    FROM_RADIUS: 50000,
    TO_RADIUS: 50000,
    EARTH_RADIUS: 6378137,
    LOAD_STATUS_ACTIVE: "Active",
    LOAD_STATUS_CANCELLED: "Cancelled",
    PENDING_STATUS: "Pending",
    NEW_BOOKING_REQUEST:"Booking Requests",
    NO_LOADS: "No loads available",
    LOADS_SUCCESS: "Loads Fetched Successfully",
    GOOGLE_DISTANCE: "Distance matrix error:",
    BODY_TYPES: ["open", "closed", "container"],

    //myloads constants
    POSTED: "posted",
    PENDING: "pending",
    REQUESTED: "requested",
    INVALID_TAB: "Invalid Tab",
    APPROVED_FLOW: [
        "Active",
        "Approved",
        "StartedTrip",
        "ReachedPickup",
        "PickedUp",
        "InTransit",
        "Delivered",
        "Completed",
    ],

    //load details constants
    USER_ROLE: "Approved User",
    OWNER_ROLE: "Load Owner",
    CONTACT_VISIBLE_STATUS: [
        "Approved",
        "StartedTrip",
        "ReachedPickup",
        "PickedUp",
        "InTransit"
    ],
    RECEIVER_VISIBLE_STATUS: ["PickedUp", "InTransit"],
    LOAD_NOT_FOUND: "Load Data Not Found or Unauthorized",
    LOAD_DETAILS_SUCCESS: "Load details fetched successfully",

    //publish load constants
    PUBLISH_SUCCESS: "Load Published Successfully",
    INVALID_COORDS: "Invalid coordinates",

    // update load constants
    SCHEDULE_DATE_NOT_UPDATE: "Loading Date is not allowed to update",
    UPDATE_FILEDS: [
        "amount",
        "loadType",
        "capacity",
        "truckType",
        "wheelers",
        "bodyType",
        "receiverName",
        "receiverNo"
    ],
    UPDATE_SUCCESS: "Load Updated Successfully",

    //delete load
    DELETE_SUCCESS: "Load Deleted Successfully",
    ALLOWED_DELETE_STATUS:[
        "Cancelled",
        "Completed",
        "Expired"
    ],

    // cancel load constants
    CANCEL_SUCCESS: "Load Cancelled Successfully"

}


module.exports = LoadConstants