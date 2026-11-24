import mongoose, {Schema} from "mongoose"


const subscriptionSchema = new Schema({

    subscriber : {
        type : Schema.Types.ObjectId, // the one who is subscribing
        ref : "User"
    },
    channel : {

        type : Schema.Types.ObjectId, // the whom subcriber is subscribing
        ref : "User"

    }

},{timestamp : true})


export const Subscription = mongoose.model("Subscription", SubscriptionSchema)



